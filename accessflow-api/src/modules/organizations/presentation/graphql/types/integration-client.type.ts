import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import { IntegrationClientEntry } from '@/modules/organizations/application/dto/integration-client-entry';
import { IntegrationClientStatus } from '@/modules/organizations/domain/entities/integration-client.entity';

registerEnumType(IntegrationClientStatus, {
  name: 'IntegrationClientStatus',
  description:
    'PROVISIONING: em criação. ACTIVE: a única que autoriza. REVOKED: revogada. FAILED: o app client não chegou a existir.',
});

@ObjectType('IntegrationCreator')
export class IntegrationCreatorType {
  @Field(() => ID)
  userId!: string;

  @Field()
  name!: string;
}

@ObjectType('IntegrationClient')
export class IntegrationClientType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field(() => String, {
    nullable: true,
    description:
      'client_id do app client no Cognito. Nulo em PROVISIONING e FAILED.',
  })
  clientId!: string | null;

  @Field(() => [String], {
    description: 'Escopos de máquina concedidos, na ordem do catálogo.',
  })
  scopes!: string[];

  @Field(() => IntegrationClientStatus)
  status!: IntegrationClientStatus;

  @Field()
  createdAt!: Date;

  @Field(() => IntegrationCreatorType, {
    nullable: true,
    description: 'Nulo nas integrações anteriores ao painel.',
  })
  createdBy!: IntegrationCreatorType | null;

  @Field(() => Date, { nullable: true })
  revokedAt!: Date | null;

  static from({
    integration,
    createdBy,
  }: IntegrationClientEntry): IntegrationClientType {
    const type = new IntegrationClientType();
    type.id = integration.id;
    type.name = integration.name;
    type.clientId = integration.clientId;
    type.scopes = [...integration.scopes];
    type.status = integration.status;
    type.createdAt = integration.createdAt;
    type.createdBy = createdBy;
    type.revokedAt = integration.revokedAt;
    return type;
  }
}

@ObjectType('CreatedIntegrationClient')
export class CreatedIntegrationClientType {
  @Field(() => IntegrationClientType)
  integration!: IntegrationClientType;

  @Field({
    description:
      'Aparece só nesta resposta: não é guardado e não pode ser consultado de novo. Perdeu? Revogue e crie outra integração.',
  })
  clientSecret!: string;
}
