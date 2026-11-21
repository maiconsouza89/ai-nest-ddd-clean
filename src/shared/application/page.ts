export type PageRequest = { page: number; limit: number };
export type Page<T> = { items: T[]; total: number; page: number; limit: number };
