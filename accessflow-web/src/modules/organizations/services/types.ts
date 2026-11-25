export namespace GetOrganizationMembers {
  export type Args = {
    organizationId: string;
    first: number;
    after?: string;
  };
}
