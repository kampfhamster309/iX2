import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const request = ctx.switchToHttp().getRequest<any>();
  return request.user;
});
