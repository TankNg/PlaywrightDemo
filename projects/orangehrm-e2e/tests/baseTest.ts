import {
  BeanContext,
  BeanLoaderOptions,
  loadBeanContext,
} from '@core-playwright/core';

const BEAN_CONTEXT: BeanLoaderOptions = {
  xmlPaths: ['config/Setting.xml', 'config/QATCredential.xml'],
  propertiesPaths: [
    'config/Environment.properties',
    'config/QATCredential.properties',
  ],
  env: 'qat',
};

export const ctx: BeanContext = loadBeanContext(import.meta.url, BEAN_CONTEXT);
