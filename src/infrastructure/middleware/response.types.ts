// src/infrastructure/middleware/response.types.ts
// Ant Design Pro 约定的统一响应格式，仅由 FormatResponseMiddleware 使用

/**
 * 显示类型枚举
 */
export enum ShowType {
  /** 静默 */
  SILENT = 0,
  /** 警告信息 */
  WARN_MESSAGE = 1,
  /** 错误信息 */
  ERROR_MESSAGE = 2,
  /** 通知 */
  NOTIFICATION = 4,
  /** 页面 */
  REDIRECT = 9,
}

/**
 * 统一响应格式接口
 * 基于 Ant Design Pro 约定
 * - 成功时：success: true, data 有值，其他错误相关字段 absent/undefined
 * - 失败时：success: false, data=null，errorCode/errorMessage/showType 必有值
 */
export interface ApiResponse<T = unknown> {
  /** 是否成功 */
  success: boolean;
  /** 响应数据（成功时有值，失败为 null） */
  data?: T | null;
  /** 错误码（失败时有值） */
  errorCode?: string;
  /** 错误信息（失败时有值） */
  errorMessage?: string;
  /** 显示类型 */
  showType?: ShowType;
  /** 便于后端故障排查的唯一请求 ID */
  requestId?: string;
  /** 服务器主机名 */
  host?: string;
}
