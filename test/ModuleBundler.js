import { assert } from 'chai';
import path from 'path';
import Yazl from 'yazl';
import ModuleBundler from '../src/lib/ModuleBundler';

describe('ModuleBundler', function () {
  this.timeout(5000);

  const servicePath = path.resolve(__dirname, './1.0');

  const artifact      = new Yazl.ZipFile();
  const moduleBundler = new ModuleBundler({
    servicePath,
  }, artifact);

  const { dependencies } = require(`${servicePath}/package.json`); // eslint-disable-line

  before(async () => {
    await moduleBundler.bundle({});
  });

  for (const dep in dependencies) {
    it(`Has bundled dependency ${dep}`, async () => {
      assert(
        moduleBundler.modules.some(({ name }) => name === dep),
      );
    });
  }
});
