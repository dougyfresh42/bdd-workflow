export default {
  default: {
    requireModule: ['ts-node/register'],
    require: ['features/support/steps/**/*.ts', 'features/support/hooks.ts'],
    format: ['progress-bar'],
    formatOptions: { snippetInterface: 'async-await' },
  }
};
