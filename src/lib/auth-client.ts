"use client";

import { createAuthClient } from "better-auth/react";

/** Talks to /api/auth on whichever publication domain the page is on. */
export const authClient = createAuthClient();
