import { LoginTypeEnum } from '@app-types/models/account.types';
import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ApiModule } from '@src/bootstraps/api/api.module';
import { WorkerModule } from '@src/bootstraps/worker/worker.module';
import { BULLMQ_QUEUES } from '@src/infrastructure/bullmq/bullmq.constants';
import { BullMqWorkerRuntime } from '@src/infrastructure/bullmq/worker.runtime';
import { TokenHelper } from '@src/modules/auth/token.helper';
import { MagicItemCraftTaskEntity } from '@src/modules/magic-item-craft/magic-item-craft-task.entity';
import { Queue } from 'bullmq';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { initGraphQLSchema } from '../../src/adapters/api/graphql/schema/schema.init';
import { login } from '../utils/e2e-graphql-utils';
import { cleanupTestAccounts, seedTestAccounts, testAccountsConfig } from '../utils/test-accounts';

type FinalJobState = 'completed' | 'failed';

const MAGIC_ITEM_CRAFT_MUTATION = `
  mutation CreateMagicItemCraftTask($input: CreateMagicItemCraftTaskInput!) {
    createMagicItemCraftTask(input: $input) {
      queued
      jobId
      traceId
    }
  }
`;

const MAGIC_ITEM_CRAFT_QUERY = `
  query MagicItemCraftTask($id: Int!) {
    magicItemCraftTask(id: $id) {
      id
      traceId
      jobId
      itemName
      itemType
      status
      qualityLevel
      resultDescription
      failureReason
      craftLog
      createdAt
      updatedAt
    }
  }
`;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const queueMagicItemCraft = async (input: {
  readonly app: INestApplication;
  readonly token?: string;
  readonly itemName: string;
  readonly itemType: string;
  readonly materialLevel: number;
  readonly requestNote?: string;
  readonly dedupKey?: string;
  readonly traceId?: string;
}): Promise<{
  readonly queued: boolean;
  readonly jobId: string;
  readonly traceId: string;
}> => {
  const req = request(input.app.getHttpServer())
    .post('/graphql')
    .send({
      query: MAGIC_ITEM_CRAFT_MUTATION,
      variables: {
        input: {
          itemName: input.itemName,
          itemType: input.itemType,
          materialLevel: input.materialLevel,
          requestNote: input.requestNote,
          dedupKey: input.dedupKey,
          traceId: input.traceId,
        },
      },
    });
  if (input.token) {
    req.set('Authorization', `Bearer ${input.token}`);
  }
  const response = await req.expect(200);
  if (response.body.errors && response.body.errors.length > 0) {
    throw new Error(JSON.stringify(response.body.errors));
  }
  return response.body.data.createMagicItemCraftTask as {
    readonly queued: boolean;
    readonly jobId: string;
    readonly traceId: string;
  };
};

const queryMagicItemCraftTask = async (input: {
  readonly app: INestApplication;
  readonly token?: string;
  readonly id: number;
}): Promise<{
  readonly id: number;
  readonly traceId: string;
  readonly jobId: string;
  readonly itemName: string;
  readonly itemType: string;
  readonly status: string;
  readonly qualityLevel: string | null;
  readonly resultDescription: string | null;
  readonly failureReason: string | null;
  readonly craftLog: string | null;
}> => {
  const req = request(input.app.getHttpServer())
    .post('/graphql')
    .send({
      query: MAGIC_ITEM_CRAFT_QUERY,
      variables: {
        id: input.id,
      },
    });
  if (input.token) {
    req.set('Authorization', `Bearer ${input.token}`);
  }
  const response = await req.expect(200);
  if (response.body.errors && response.body.errors.length > 0) {
    throw new Error(JSON.stringify(response.body.errors));
  }
  return response.body.data.magicItemCraftTask;
};

const waitJobFinalState = async (input: {
  readonly queue: Queue;
  readonly jobId: string;
  readonly timeoutMs: number;
  readonly pollMs: number;
}): Promise<{
  readonly state: FinalJobState;
  readonly returnvalue: unknown;
  readonly failedReason: string | undefined;
}> => {
  const deadline = Date.now() + input.timeoutMs;
  while (Date.now() < deadline) {
    const job = await input.queue.getJob(input.jobId);
    if (job) {
      const state = await job.getState();
      if (state === 'completed' || state === 'failed') {
        return {
          state,
          returnvalue: job.returnvalue,
          failedReason: job.failedReason,
        };
      }
    }
    await sleep(input.pollMs);
  }
  throw new Error(`Magic item craft job did not reach final state in time: ${input.jobId}`);
};

const findMagicItemCraftTask = async (input: {
  readonly dataSource: DataSource;
  readonly traceId: string;
}): Promise<MagicItemCraftTaskEntity | null> => {
  return await input.dataSource.getRepository(MagicItemCraftTaskEntity).findOne({
    where: { traceId: input.traceId },
    order: { id: 'DESC' },
  });
};

const waitMagicItemCraftTask = async (input: {
  readonly dataSource: DataSource;
  readonly traceId: string;
  readonly timeoutMs: number;
  readonly pollMs: number;
  readonly statuses?: ReadonlyArray<string>;
}): Promise<MagicItemCraftTaskEntity> => {
  const deadline = Date.now() + input.timeoutMs;
  while (Date.now() < deadline) {
    const task = await findMagicItemCraftTask({
      dataSource: input.dataSource,
      traceId: input.traceId,
    });
    if (task) {
      if (!input.statuses || input.statuses.includes(task.status)) {
        return task;
      }
    }
    await sleep(input.pollMs);
  }
  throw new Error(`Magic item craft task did not reach expected state in time: ${input.traceId}`);
};

describe('魔法道具工坊（e2e）', () => {
  let apiApp: INestApplication;
  let workerApp: INestApplication;
  let magicItemCraftQueue: Queue;
  let workerRuntime: BullMqWorkerRuntime;
  let dataSource: DataSource;
  let staffPrimaryToken: string;
  let staffPrimaryAccountId: number;
  let staffPrimaryActiveRole: string;
  let adminToken: string;
  let adminAccountId: number;
  let adminActiveRole: string;
  let guestPrimaryToken: string;

  beforeAll(async () => {
    initGraphQLSchema();

    const apiModuleFixture: TestingModule = await Test.createTestingModule({
      imports: [ApiModule],
    }).compile();
    apiApp = apiModuleFixture.createNestApplication();
    await apiApp.init();

    const workerModuleFixture: TestingModule = await Test.createTestingModule({
      imports: [WorkerModule],
    }).compile();
    workerApp = workerModuleFixture.createNestApplication();
    await workerApp.init();

    magicItemCraftQueue = apiApp.get<Queue>(getQueueToken(BULLMQ_QUEUES.MAGIC_ITEM_CRAFT));
    workerRuntime = workerApp.get(BullMqWorkerRuntime);
    dataSource = apiApp.get(DataSource);

    await cleanupTestAccounts(dataSource);
    await seedTestAccounts({
      dataSource,
      includeKeys: ['staffPrimary', 'admin', 'guestPrimary'],
    });

    staffPrimaryToken = await login({
      app: apiApp,
      loginName: testAccountsConfig.staffPrimary.loginName,
      loginPassword: testAccountsConfig.staffPrimary.loginPassword,
      type: LoginTypeEnum.PASSWORD,
    });
    const tokenHelper = apiApp.get(TokenHelper);
    const staffPrimaryPayload = tokenHelper.decodeToken({ token: staffPrimaryToken });
    if (!staffPrimaryPayload?.sub) {
      throw new Error('无法从 staff primary token 获取 sub');
    }
    staffPrimaryAccountId = staffPrimaryPayload.sub;
    staffPrimaryActiveRole = String(staffPrimaryPayload.activeRole ?? '');

    adminToken = await login({
      app: apiApp,
      loginName: testAccountsConfig.admin.loginName,
      loginPassword: testAccountsConfig.admin.loginPassword,
      type: LoginTypeEnum.PASSWORD,
    });
    const adminPayload = tokenHelper.decodeToken({ token: adminToken });
    if (!adminPayload?.sub) {
      throw new Error('无法从 admin token 获取 sub');
    }
    adminAccountId = adminPayload.sub;
    adminActiveRole = String(adminPayload.activeRole ?? '');

    guestPrimaryToken = await login({
      app: apiApp,
      loginName: testAccountsConfig.guestPrimary.loginName,
      loginPassword: testAccountsConfig.guestPrimary.loginPassword,
      type: LoginTypeEnum.PASSWORD,
    });

    void staffPrimaryAccountId;
    void staffPrimaryActiveRole;
    void adminAccountId;
    void adminActiveRole;
  }, 60000);

  afterAll(async () => {
    await cleanupTestAccounts(dataSource);
    if (workerApp) {
      await workerApp.close();
    }
    if (apiApp) {
      await apiApp.close();
    }
  });

  it('成功入队并完成制作任务', async () => {
    const timestamp = Date.now();
    const traceId = `e2e-magic-item-success-${timestamp}`;
    const dedupKey = `e2e-magic-item-dedup-${timestamp}`;

    const enqueueResult = await queueMagicItemCraft({
      app: apiApp,
      token: staffPrimaryToken,
      itemName: '火焰剑',
      itemType: 'WEAPON',
      materialLevel: 5,
      requestNote: '请制作一把火焰剑',
      dedupKey,
      traceId,
    });

    expect(enqueueResult.queued).toBe(true);
    expect(enqueueResult.traceId).toBe(traceId);
    expect(enqueueResult.jobId).toBe(dedupKey);

    const task = await waitMagicItemCraftTask({
      dataSource,
      traceId,
      statuses: ['PENDING', 'PROCESSING'],
      timeoutMs: 5000,
      pollMs: 100,
    });
    expect(task.status).toBe('PENDING');
    expect(task.traceId).toBe(traceId);
    expect(task.jobId).toBe(dedupKey);
    expect(task.itemName).toBe('火焰剑');
    expect(task.itemType).toBe('WEAPON');
    expect(task.materialLevel).toBe(5);

    const finalState = await waitJobFinalState({
      queue: magicItemCraftQueue,
      jobId: dedupKey,
      timeoutMs: 30000,
      pollMs: 150,
    });
    expect(finalState.state).toBe('completed');

    const succeededTask = await waitMagicItemCraftTask({
      dataSource,
      traceId,
      statuses: ['SUCCEEDED'],
      timeoutMs: 20000,
      pollMs: 150,
    });
    expect(succeededTask.status).toBe('SUCCEEDED');
    expect(succeededTask.qualityLevel).toBeDefined();
    expect(succeededTask.resultDescription).toBeDefined();
    expect(succeededTask.craftLog).toBeDefined();

    const queriedTask = await queryMagicItemCraftTask({
      app: apiApp,
      token: staffPrimaryToken,
      id: succeededTask.id,
    });
    expect(queriedTask.id).toBe(succeededTask.id);
    expect(queriedTask.status).toBe('SUCCEEDED');
    expect(queriedTask.qualityLevel).toBe(succeededTask.qualityLevel);
    expect(queriedTask.resultDescription).toBe(succeededTask.resultDescription);
  }, 60000);

  it('暂停消费后应先无记录，恢复消费后应落库为 succeeded', async () => {
    const timestamp = Date.now();
    const traceId = `e2e-magic-item-stage-success-${timestamp}`;
    const dedupKey = `e2e-magic-item-stage-dedup-${timestamp}`;

    try {
      await workerRuntime.stop();

      const enqueueResult = await queueMagicItemCraft({
        app: apiApp,
        token: staffPrimaryToken,
        itemName: '冰霜法杖',
        itemType: 'STAFF',
        materialLevel: 3,
        requestNote: '请制作一根冰霜法杖',
        dedupKey,
        traceId,
      });

      expect(enqueueResult.queued).toBe(true);
      expect(enqueueResult.traceId).toBe(traceId);

      const job = await magicItemCraftQueue.getJob(dedupKey);
      expect(job).toBeDefined();

      const taskBeforeStart = await waitMagicItemCraftTask({
        dataSource,
        traceId,
        statuses: ['PENDING'],
        timeoutMs: 5000,
        pollMs: 100,
      });
      expect(taskBeforeStart.status).toBe('PENDING');
      expect(taskBeforeStart.traceId).toBe(traceId);

      await workerRuntime.start();

      const processingTask = await waitMagicItemCraftTask({
        dataSource,
        traceId,
        statuses: ['PROCESSING'],
        timeoutMs: 5000,
        pollMs: 100,
      });
      expect(processingTask.status).toBe('PROCESSING');

      const finalState = await waitJobFinalState({
        queue: magicItemCraftQueue,
        jobId: dedupKey,
        timeoutMs: 30000,
        pollMs: 150,
      });
      expect(finalState.state).toBe('completed');

      const succeededTask = await waitMagicItemCraftTask({
        dataSource,
        traceId,
        statuses: ['SUCCEEDED'],
        timeoutMs: 20000,
        pollMs: 150,
      });
      expect(succeededTask.status).toBe('SUCCEEDED');
      expect(succeededTask.qualityLevel).toBeDefined();
      expect(succeededTask.resultDescription).toBeDefined();
    } finally {
      await workerRuntime.start();
    }
  }, 60000);

  it('相同 dedupKey 重复入队应复用原 jobId/traceId', async () => {
    const timestamp = Date.now();
    const dedupKey = `e2e-magic-item-dedup-${timestamp}`;
    const firstTraceId = `e2e-magic-item-dedup-first-${timestamp}`;
    const secondTraceId = `e2e-magic-item-dedup-second-${timestamp}`;

    try {
      await workerRuntime.stop();

      const firstEnqueue = await queueMagicItemCraft({
        app: apiApp,
        token: staffPrimaryToken,
        itemName: '治疗药水',
        itemType: 'POTION',
        materialLevel: 2,
        dedupKey,
        traceId: firstTraceId,
      });

      const secondEnqueue = await queueMagicItemCraft({
        app: apiApp,
        token: adminToken,
        itemName: '治疗药水',
        itemType: 'POTION',
        materialLevel: 3,
        dedupKey,
        traceId: secondTraceId,
      });

      expect(firstEnqueue.jobId).toBe(dedupKey);
      expect(secondEnqueue.jobId).toBe(dedupKey);
      expect(firstEnqueue.traceId).toBe(firstTraceId);
      expect(secondEnqueue.traceId).toBe(firstTraceId);

      await workerRuntime.start();

      const task = await waitMagicItemCraftTask({
        dataSource,
        traceId: firstTraceId,
        statuses: ['SUCCEEDED'],
        timeoutMs: 30000,
        pollMs: 150,
      });
      expect(task.traceId).toBe(firstTraceId);
      expect(task.jobId).toBe(dedupKey);
    } finally {
      await workerRuntime.start();
    }
  }, 60000);

  describe('边界权限测试', () => {
    it('未登录调用 createMagicItemCraftTask 应返回未认证错误', async () => {
      const response = await request(apiApp.getHttpServer())
        .post('/graphql')
        .send({
          query: MAGIC_ITEM_CRAFT_MUTATION,
          variables: {
            input: {
              itemName: '测试道具',
              itemType: 'WEAPON',
              materialLevel: 1,
            },
          },
        })
        .expect(200);
      const errors = (response.body as { errors?: Array<{ message?: string }> }).errors ?? [];
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]?.message ?? '').toMatch(/Unauthorized|未认证|认证/);
    });

    it('非 staff 角色调用 createMagicItemCraftTask 应返回权限错误', async () => {
      const response = await request(apiApp.getHttpServer())
        .post('/graphql')
        .send({
          query: MAGIC_ITEM_CRAFT_MUTATION,
          variables: {
            input: {
              itemName: '测试道具',
              itemType: 'WEAPON',
              materialLevel: 1,
            },
          },
        })
        .set('Authorization', `Bearer ${guestPrimaryToken}`)
        .expect(200);
      const errors = (response.body as { errors?: Array<{ message?: string }> }).errors ?? [];
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]?.message ?? '').toMatch(
        /无权限|拒绝|Forbidden|forbidden|access denied|缺少所需角色/i,
      );
    });

    it('非法输入 itemName 为空应返回校验错误', async () => {
      const response = await request(apiApp.getHttpServer())
        .post('/graphql')
        .send({
          query: MAGIC_ITEM_CRAFT_MUTATION,
          variables: {
            input: {
              itemName: '',
              itemType: 'WEAPON',
              materialLevel: 1,
            },
          },
        })
        .set('Authorization', `Bearer ${staffPrimaryToken}`)
        .expect(200);
      const errors = (response.body as { errors?: Array<{ message?: string }> }).errors ?? [];
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]?.message ?? '').toMatch(/不能为空|Validation failed|校验|validation/i);
    });

    it('非法输入 materialLevel 超出范围应返回校验错误', async () => {
      const response = await request(apiApp.getHttpServer())
        .post('/graphql')
        .send({
          query: MAGIC_ITEM_CRAFT_MUTATION,
          variables: {
            input: {
              itemName: '测试道具',
              itemType: 'WEAPON',
              materialLevel: 100,
            },
          },
        })
        .set('Authorization', `Bearer ${staffPrimaryToken}`)
        .expect(200);
      const errors = (response.body as { errors?: Array<{ message?: string }> }).errors ?? [];
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]?.message ?? '').toMatch(/最大|最小|范围|Validation failed|校验|validation/i);
    });

    it('未登录查询任务应返回查询结果', async () => {
      const timestamp = Date.now();
      const traceId = `e2e-magic-item-query-public-${timestamp}`;
      const dedupKey = `e2e-magic-item-query-dedup-${timestamp}`;

      await queueMagicItemCraft({
        app: apiApp,
        token: staffPrimaryToken,
        itemName: '公开查询测试',
        itemType: 'ARMOR',
        materialLevel: 1,
        dedupKey,
        traceId,
      });

      const task = await waitMagicItemCraftTask({
        dataSource,
        traceId,
        statuses: ['PENDING', 'PROCESSING', 'SUCCEEDED'],
        timeoutMs: 30000,
        pollMs: 150,
      });

      const queriedTask = await queryMagicItemCraftTask({
        app: apiApp,
        id: task.id,
      });
      expect(queriedTask.id).toBe(task.id);
      expect(queriedTask.traceId).toBe(traceId);
    });
  });

  describe('不同道具类型测试', () => {
    const itemTypes = ['WEAPON', 'ARMOR', 'STAFF', 'POTION', 'ACCESSORY'];

    it.each(itemTypes)('应支持道具类型 %s', async (itemType) => {
      const timestamp = Date.now();
      const traceId = `e2e-magic-item-type-${itemType}-${timestamp}`;
      const dedupKey = `e2e-magic-item-type-${itemType}-dedup-${timestamp}`;

      const enqueueResult = await queueMagicItemCraft({
        app: apiApp,
        token: staffPrimaryToken,
        itemName: `${itemType}测试道具`,
        itemType,
        materialLevel: 3,
        dedupKey,
        traceId,
      });

      expect(enqueueResult.queued).toBe(true);

      const task = await waitMagicItemCraftTask({
        dataSource,
        traceId,
        statuses: ['SUCCEEDED'],
        timeoutMs: 30000,
        pollMs: 150,
      });
      expect(task.status).toBe('SUCCEEDED');
      expect(task.itemType).toBe(itemType);
    });
  });

  describe('不同品质等级测试', () => {
    it('materialLevel 1-3 应生成普通到优秀品质', async () => {
      const materialLevels = [1, 2, 3];
      const results: Array<{ materialLevel: number; qualityLevel: string }> = [];

      for (const materialLevel of materialLevels) {
        const timestamp = Date.now();
        const traceId = `e2e-magic-item-quality-${materialLevel}-${timestamp}`;
        const dedupKey = `e2e-magic-item-quality-${materialLevel}-dedup-${timestamp}`;

        await queueMagicItemCraft({
          app: apiApp,
          token: staffPrimaryToken,
          itemName: `品质测试道具${materialLevel}`,
          itemType: 'WEAPON',
          materialLevel,
          dedupKey,
          traceId,
        });

        const task = await waitMagicItemCraftTask({
          dataSource,
          traceId,
          statuses: ['SUCCEEDED'],
          timeoutMs: 30000,
          pollMs: 150,
        });

        results.push({ materialLevel, qualityLevel: task.qualityLevel ?? '' });
      }

      expect(results.length).toBe(3);
      results.forEach(({ qualityLevel }) => {
        expect(qualityLevel).toMatch(/NORMAL|GOOD|EXCELLENT/);
      });
    });
  });
});
