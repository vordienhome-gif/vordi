export class HttpError extends Error {
  constructor(public statusCode: number, message: string, public code = 'error') { super(message); }
}
export const notFound = (what = 'Объект') => new HttpError(404, `${what} не найден`, 'not_found');
export const forbidden = () => new HttpError(403, 'Недостаточно прав', 'forbidden');
