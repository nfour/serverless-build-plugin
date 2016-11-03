/**
 *  WIP shim for serverless@0.5 to replace the existing method.
 *  This should not have any repeated logic from within the main plugin.
 */

import ServerlessBuildPlugin from '../ServerlessBuildPlugin';

export default function (S) {
  const SCli = require(S.getServerlessPath('utils/cli')); // eslint-disable-line

  return class ServerlessBuildPluginShim extends S.classes.Plugin {


  };
}
