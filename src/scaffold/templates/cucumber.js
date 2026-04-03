export default {
  default: {
    requireModule: ['ts-node/register'],
    require: ['features/support/**/*.ts'],
    format: ['progress-bar'],
    formatOptions: { snippetInterface: 'async-await' },
  }
};
