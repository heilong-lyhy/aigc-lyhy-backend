// src/types/common/field-encryption.metadata.ts
// 字段加密元数据：注册函数与 metadata key
// 仅声明侧逻辑，读取侧（getEncryptedFields）留在 infrastructure 层

import 'reflect-metadata';

export const ENCRYPTED_FIELDS_METADATA_KEY = 'core:encrypted_fields';

export const registerEncryptedField = (target: object, propertyKey: string | symbol): void => {
  const existing: readonly (string | symbol)[] =
    (Reflect.getMetadata(ENCRYPTED_FIELDS_METADATA_KEY, target) as
      readonly (string | symbol)[] | undefined) ?? [];
  Reflect.defineMetadata(
    ENCRYPTED_FIELDS_METADATA_KEY,
    [...new Set([...existing, propertyKey])],
    target,
  );
};
