// src/adapters/api/graphql/schema/scalar.registry.ts

/**
 * 注册所有 GraphQL 自定义标量类型
 * @returns 注册结果，包含已注册的标量名称列表
 */
export function registerScalars(): { scalars: string[] } {
  const registeredScalars: string[] = [];

  // 注意：在 NestJS 中，Date 类型会自动映射为 GraphQLISODateTime
  // 无需手动注册，GraphQL 会自动处理 Date 类型的序列化和反序列化
  // [MERGED] 采纳自框架新版

  // 启用 JSON 标量类型（由 @Scalar('JSON') 提供者注册），这里仅记录类型名称用于指纹生成
  registeredScalars.push('JSON');

  // Upload 标量通过 upload.scalar.ts 中的 GraphQLUpload 定义， // [KEPT:业务保留]
  // 由 DTO 的 @Field(() => GraphQLUpload) 触发注册到 schema // [KEPT:业务保留]
  registeredScalars.push('Upload'); // [KEPT:业务保留]

  return { scalars: registeredScalars };
}
