import { Logger } from '@nestjs/common';
import {
  IdentityProfile,
  IdentityProfilePort,
} from '../../application/ports/identity-profile.port';

import {
  CognitoIdentityProviderClient,
  GetUserCommand,
  NotAuthorizedException,
} from '@aws-sdk/client-cognito-identity-provider';
import { InvalidAccessTokenError } from '../../application/errors/invalid-access-token.error';

export class CognitoIdentityProfileProvider extends IdentityProfilePort {
  private readonly logger = new Logger(CognitoIdentityProfileProvider.name);

  constructor(private readonly client: CognitoIdentityProviderClient) {
    super();
  }

  static fromUserPoolId(userPoolId: string): CognitoIdentityProfileProvider {
    const region = userPoolId.split('_')[0];

    return new CognitoIdentityProfileProvider(
      new CognitoIdentityProviderClient({ region }),
    );
  }

  async getProfile(accessToken: string): Promise<IdentityProfile> {
    try {
      const output = await this.client.send(
        new GetUserCommand({ AccessToken: accessToken }),
      );
      const atribute = (name: string) =>
        output.UserAttributes?.find((attr) => attr.Name === name)?.Value;

      const sub = atribute('sub');
      const email = atribute('email');

      if (!sub || !email) {
        throw new Error('Cognito GetUser não retornou sub ou email');
        this.logger.log('Sub:', sub, 'Email:', email);
      }

      return {
        sub,
        email,
        emailVerified: atribute('email_verified') === 'true',
      };
    } catch (error) {
      if (error instanceof NotAuthorizedException) {
        this.logger.warn(`GetUser recusado: ${error.message}`);
        throw new InvalidAccessTokenError();
      }

      throw error;
    }
  }
}
