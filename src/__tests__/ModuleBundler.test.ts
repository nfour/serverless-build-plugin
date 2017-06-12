import * as Archiver from 'archiver';
import * as path from 'path';
import { Logger } from '../lib/Logger';
import { ModuleBundler } from '../ModuleBundler';

describe('ModuleBundler', () => {
  const servicePath = path.resolve(__dirname, '../../test/1.0');

  const artifact = Archiver('zip', { store: true });
  const moduleBundler = new ModuleBundler({
    servicePath,
    logger: new Logger(),
    archive: artifact,
  });

  const { dependencies } = require(`${servicePath}/package.json`); // eslint-disable-line

  beforeAll(async () => {
    await moduleBundler.bundle({});
  });

  Object.keys(dependencies).forEach((dep) => {
    it(`Has bundled dependency ${dep}`, async () => {
      expect(
        moduleBundler.modules.some(({ name }) => name === dep),
      ).toBeTruthy();
    });
  });
});
