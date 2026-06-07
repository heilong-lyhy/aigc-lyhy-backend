// src/adapters/api/graphql/schema/upload.scalar.ts
// Upload 标量定义：用于 GraphQL multipart 请求中的文件上传
// 遵循 GraphQL multipart request specification

import { GraphQLScalarType } from 'graphql';

// eslint-disable-next-line @typescript-eslint/naming-convention
export const GraphQLUpload = new GraphQLScalarType({
  name: 'Upload',
  description: 'The `Upload` scalar type represents a file upload.',
  parseValue(value: unknown) {
    // graphql-upload 中间件将上传的文件解析为 Promise<FileUpload>
    return value;
  },
  parseLiteral(): never {
    throw new Error('Upload scalar literal is not supported. Use variables instead.');
  },
  serialize(): never {
    throw new Error('Upload scalar serialization is not supported.');
  },
});
