export interface OAuthAuthorizeRequest {
  clientId: string;
  redirectUri: string;
  responseType: string;
  state?: string;
  scope?: string;
}

export interface OAuthTokenRequest {
  grantType: string;
  code: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
}

export interface OAuthApproveRequest {
  clientId: string;
  redirectUri: string;
  scope?: string | string[];
  state?: string;
}

export interface OAuthTokenResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
}
