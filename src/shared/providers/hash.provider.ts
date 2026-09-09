import * as argon2 from 'argon2';

export interface IHashProvider {
  hash(password: string): Promise<string>;
  verify(hash: string, plain: string): Promise<boolean>;
}

export class HashProvider implements IHashProvider {
  /**
   * Hashes a plain text password using Argon2id with OWASP recommended baseline parameters.
   */
  async hash(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
  }

  /**
   * Verifies a plain text password against an Argon2id hash.
   * Returns false safely if verification fails or if the hash is malformed.
   */
  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }
}

export const hashProvider = new HashProvider();
