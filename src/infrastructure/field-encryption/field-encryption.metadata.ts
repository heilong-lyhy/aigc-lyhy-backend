// src/infrastructure/field-encryption/field-encryption.metadata.ts
// Re-export from types layer + 保留读取侧逻辑

import 'reflect-metadata';
import {
  ENCRYPTED_FIELDS_METADATA_KEY,
  registerEncryptedField,
} from '@app-types/common/field-encryption.metadata';

export { ENCRYPTED_FIELDS_METADATA_KEY, registerEncryptedField };

export const getEncryptedFields = (target: object): readonly (string | symbol)[] => {
  return (Reflect.getMetadata(ENCRYPTED_FIELDS_METADATA_KEY, target) ?? []) as readonly (
    string | symbol
  )[];
};
