#!/usr/bin/env node
/**
 * Generate a VAPID key pair for Web Push.
 *
 * Usage:
 *   node scripts/generate-vapid-keys.mjs            print keys to stdout
 *   node scripts/generate-vapid-keys.mjs --write    write keys into .env directly
 *
 * Use --write from an agent/CI shell so secret values never need to be
 * copied manually.
 */
import webpush from "web-push";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const keys = webpush.generateVAPIDKeys();
const write = process.argv.includes("--write");

if (!write) {
  console.log("VAPID_PUBLIC_KEY=" + keys.publicKey);
  console.log("VAPID_PRIVATE_KEY=" + keys.privateKey);
  console.log("\nCopy the private key above into .env, or run this instead:");
  console.log("  npm run vapid:generate -- --write   (writes both keys into .env for you)");
  process.exit(0);
}

const envPath = resolve(process.cwd(), ".env");
if (!existsSync(envPath)) {
  console.error(".env not found. Copy .env.example to .env first.");
  process.exit(1);
}

let env = readFileSync(envPath, "utf8");

function setKey(content, name, value) {
  const pattern = new RegExp(`^${name}=.*$`, "m");
  const line = `${name}="${value}"`;
  if (pattern.test(content)) return content.replace(pattern, line);
  return content.endsWith("\n") || content.length === 0 ? content + line + "\n" : content + "\n" + line + "\n";
}

env = setKey(env, "VAPID_PUBLIC_KEY", keys.publicKey);
env = setKey(env, "VAPID_PRIVATE_KEY", keys.privateKey);
writeFileSync(envPath, env);

console.log("VAPID keys written to .env");
console.log("VAPID_PUBLIC_KEY present:", keys.publicKey.length > 60);
console.log("VAPID_PRIVATE_KEY present:", keys.privateKey.length > 40);
