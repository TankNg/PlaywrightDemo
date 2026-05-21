import { test } from '@playwright/test';
import {ctx} from './baseTest.js';


test('Bean context is preloaded in base test', async ({}) => {
  const credential = ctx.getCredential('qatUser1');
  const environment = ctx.getEnvironment();
  console.log(credential.username, credential.password);
  console.log(environment.webserviceUrl);
});
