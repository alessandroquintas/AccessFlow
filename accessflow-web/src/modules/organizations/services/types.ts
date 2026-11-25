// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace GetOrganizationMembers {
  export type Args = {
    organizationId: string;
    first: number;
    after?: string;
  };
}
