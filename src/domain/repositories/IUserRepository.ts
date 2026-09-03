export interface IUserRepository {
  findById(id: string): Promise<{ id: string; name: string; email: string } | null>;
}
