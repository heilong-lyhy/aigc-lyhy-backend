// src/adapters/api/graphql/schema/enum.registry.ts

import {
  // 导入所有需要注册的枚举类型（仅依赖 @app-types）
  AccountStatus,
  AudienceTypeEnum,
  EmploymentStatus,
  IdentityTypeEnum,
  LoginTypeEnum,
  ThirdPartyLoginProviderEnum,
  ThirdPartyProviderEnum,
} from '@app-types/models/account.types';
import { Gender, UserState } from '@app-types/models/user-info.types';
import {
  CreatableVerificationRecordType,
  SubjectType,
  VerificationRecordStatus,
  VerificationRecordType,
} from '@app-types/models/verification-record.types';
import { RegisterTypeEnum } from '@app-types/services/register.types';
import { registerEnumType } from '@nestjs/graphql';
import { GqlPaginationMode, GqlSortDirection } from '@src/adapters/api/graphql/pagination.enums';
import { OrderDirection } from '@app-types/common/sort.types';
import {
  MagicItemCraftTaskQualityLevel,
  MagicItemCraftTaskStatus,
  MagicItemCraftTaskType,
} from '@app-types/models/magic-item-craft.types';
import { BlogPostStatus, BlogCommentStatus, BlogFileType } from '@app-types/models/blog.types';

export function registerEnums(): { enums: string[] } {
  const registeredEnums: string[] = [];

  registerEnumType(AccountStatus, { name: 'AccountStatus' });
  registeredEnums.push('AccountStatus');
  registerEnumType(AudienceTypeEnum, { name: 'AudienceTypeEnum' });
  registeredEnums.push('AudienceTypeEnum');
  registerEnumType(EmploymentStatus, { name: 'EmploymentStatus' });
  registeredEnums.push('EmploymentStatus');
  registerEnumType(IdentityTypeEnum, { name: 'IdentityTypeEnum' });
  registeredEnums.push('IdentityTypeEnum');
  registerEnumType(LoginTypeEnum, { name: 'LoginTypeEnum' });
  registeredEnums.push('LoginTypeEnum');
  registerEnumType(ThirdPartyLoginProviderEnum, { name: 'ThirdPartyLoginProviderEnum' });
  registeredEnums.push('ThirdPartyLoginProviderEnum');
  registerEnumType(ThirdPartyProviderEnum, { name: 'ThirdPartyProviderEnum' });
  registeredEnums.push('ThirdPartyProviderEnum');
  registerEnumType(RegisterTypeEnum, { name: 'RegisterTypeEnum' });
  registeredEnums.push('RegisterTypeEnum');
  registerEnumType(Gender, { name: 'Gender' });
  registeredEnums.push('Gender');
  registerEnumType(UserState, { name: 'UserState' });
  registeredEnums.push('UserState');
  registerEnumType(SubjectType, { name: 'SubjectType' });
  registeredEnums.push('SubjectType');
  registerEnumType(VerificationRecordStatus, { name: 'VerificationRecordStatus' });
  registeredEnums.push('VerificationRecordStatus');
  registerEnumType(VerificationRecordType, { name: 'VerificationRecordType' });
  registeredEnums.push('VerificationRecordType');
  registerEnumType(CreatableVerificationRecordType, { name: 'CreatableVerificationRecordType' });
  registeredEnums.push('CreatableVerificationRecordType');
  registerEnumType(OrderDirection, { name: 'OrderDirection' });
  registeredEnums.push('OrderDirection');
  registerEnumType(GqlPaginationMode, { name: 'PaginationMode' });
  registeredEnums.push('PaginationMode');
  registerEnumType(GqlSortDirection, { name: 'SortDirection' });
  registeredEnums.push('SortDirection');
  registerEnumType(MagicItemCraftTaskStatus, {
    name: 'MagicItemCraftTaskStatus',
    description: '任务状态',
  });
  registeredEnums.push('MagicItemCraftTaskStatus');
  registerEnumType(MagicItemCraftTaskType, {
    name: 'MagicItemCraftTaskType',
    description: '道具类型',
  });
  registeredEnums.push('MagicItemCraftTaskType');
  registerEnumType(MagicItemCraftTaskQualityLevel, {
    name: 'MagicItemCraftTaskQualityLevel',
    description: '品质等级',
  });
  registeredEnums.push('MagicItemCraftTaskQualityLevel');
  registerEnumType(BlogPostStatus, {
    name: 'BlogPostStatus',
    description: '文章状态',
  });
  registeredEnums.push('BlogPostStatus');
  registerEnumType(BlogCommentStatus, {
    name: 'BlogCommentStatus',
    description: '评论审核状态',
  });
  registeredEnums.push('BlogCommentStatus');
  registerEnumType(BlogFileType, {
    name: 'BlogFileType',
    description: '博客文件类型',
  });
  registeredEnums.push('BlogFileType');

  return { enums: registeredEnums };
}
