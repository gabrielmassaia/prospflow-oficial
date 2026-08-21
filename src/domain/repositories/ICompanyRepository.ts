export interface ICompanyRepository {
  create(data: {
    name: string;
    slug: string;
    ownerId: string;
  }): Promise<{ id: string; name: string; slug: string }>;

  findByUserId(userId: string): Promise<{ id: string; name: string; slug: string } | null>;
}