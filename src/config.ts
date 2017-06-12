import { ArchiverOptions } from 'archiver';

export const defaultConfig: IPluginConfig = {
  method: 'bundle',

  useServerlessOffline: false,

  tryFiles: ['webpack.config.js'],
  baseExclude: [/\bnode_modules\b/],

  modules: {
    exclude: [],
    deepExclude: [],
  },

  exclude: [],
  include: [],

  uglify: false,
  uglifySource: false,
  uglifyModules: true,

  babel: null,
  babili: false,
  normalizeBabelExt: false,
  sourceMaps: true,

  transformExtensions: ['ts', 'js', 'jsx', 'tsx'],
  handlerEntryExt: 'js',

  zip: { gzip: true, gzipOptions: { level: 5 } },
  followSymlinks: true,

  functions: {},

  synchronous: true,
  deploy: true,

  silent: false,
};

export interface IPluginConfig {
  method: 'bundle' | 'file';

  useServerlessOffline: boolean;

  tryFiles: string[];
  baseExclude: RegExp[];

  modules: {
    exclude: string[],
    deepExclude: string[],
  };

  exclude: string[];
  include: string[];

  uglify: boolean;
  uglifySource: boolean;
  uglifyModules: boolean;

  babel: any;
  babili: boolean;
  normalizeBabelExt: boolean;
  sourceMaps: boolean;

  transformExtensions: string[];
  handlerEntryExt: string;

  /** `archiver` options */
  zip: ArchiverOptions;
  followSymlinks: boolean;

  functions: any;

  synchronous: boolean;
  deploy: boolean;

  /** When true, there will be no logs */
  silent: boolean;

  // Params
  f?: string;
  function?: string;
  noDeploy?: boolean;
  keep?: boolean;
}
