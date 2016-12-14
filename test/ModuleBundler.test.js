import path from 'path';
import Yazl from 'yazl';
import ModuleBundler from '../src/lib/ModuleBundler';

describe('ModuleBundler', () => {
  const servicePath = path.resolve(__dirname, './1.0');

  const artifact      = new Yazl.ZipFile();
  const moduleBundler = new ModuleBundler({
    servicePath,
  }, artifact);

  const { dependencies } = require(`${servicePath}/package.json`); // eslint-disable-line

  beforeAll(async () => {
    await moduleBundler.bundle({});
  });

  for (const dep in dependencies) {
    it(`Has bundled dependency ${dep}`, async () => {
      expect(
        moduleBundler.modules.some(({ name }) => name === dep),
      ).toBeTruthy();
    });
  }
});
