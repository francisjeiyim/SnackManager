import { Body, Controller, Get, Post } from "@nestjs/common";
import { schemas, type LoginInput } from "@snackmanager/shared";
import { z } from "zod";
import { ZodBody } from "../common/zod-validation.pipe";
import { CurrentUser, Public, type AuthUser } from "../common/decorators";
import { AuthService } from "./auth.service";

const refreshSchema = z.object({ refreshToken: z.string().min(1) });

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post("login")
  login(@Body(new ZodBody(schemas.loginSchema)) dto: LoginInput) {
    return this.auth.login(dto);
  }

  @Public()
  @Post("refresh")
  refresh(@Body(new ZodBody(refreshSchema)) dto: { refreshToken: string }) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Public()
  @Post("logout")
  async logout(@Body(new ZodBody(refreshSchema)) dto: { refreshToken: string }) {
    await this.auth.logout(dto.refreshToken);
    return { ok: true };
  }

  @Get("me")
  me(@CurrentUser() user: AuthUser) {
    return user;
  }
}
