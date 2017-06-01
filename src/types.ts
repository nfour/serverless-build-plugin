export interface IPluginConfig {
  method: 'bundle'|'file';

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

  // Passed to `yazl` as options
  zip: { compress: boolean };

  functions: any;

  synchronous: boolean;
  deploy: boolean;

  // Params
  f?: string;
  function?: string;
  noDeploy?: boolean;
  keep?: boolean;
}

export interface ISls {
  [key: string]: any;
}
