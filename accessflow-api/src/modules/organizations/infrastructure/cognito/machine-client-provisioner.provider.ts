import { Provider } from '@nestjs/common';
import { EnvService } from '@/config/env.service';
import { MachineClientProvisioner } from '@/modules/organizations/application/ports/machine-client-provisioner.port';
import { CognitoMachineClientProvisioner } from './cognito-machine-client.provisioner';

/** O mesmo na API e na reconciliação (npm run reconcile:integrations). */
export const machineClientProvisionerProvider: Provider = {
  provide: MachineClientProvisioner,
  inject: [EnvService],
  useFactory: (env: EnvService) =>
    CognitoMachineClientProvisioner.fromUserPoolId(
      env.get('COGNITO_USER_POOL_ID'),
    ),
};
