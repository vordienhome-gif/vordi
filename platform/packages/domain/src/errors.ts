/** İş kuralı ihlali. API katmanı bunu 400/409 olarak döndürür. */
export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'domain_error',
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
