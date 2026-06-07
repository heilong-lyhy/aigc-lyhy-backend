// src/adapters/api/graphql/schema/scalar.registry.ts

/**
 * 注册所有 GraphQL 自定义标量类型
 * @returns 注册结果，包含已注册的标量名称列表
 */
export function registerScalars(): { scalars: string[] } {
  const registeredScalars: string[] = [];

  // 启用 JSON 标量类型（由 @Scalar('JSON') 提供者注册），这里仅记录类型名称用于指纹生成
  registeredScalars.push('JSON');

  // Upload 标量通过 upload.scalar.ts 中的 GraphQLUpload 定义，
  // 由 DTO 的 @Field(() => GraphQLUpload) 触发注册到 schema
  registeredScalars.push('Upload');

  return { scalars: registeredScalars };
}
