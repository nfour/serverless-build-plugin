import * as Archiver from 'archiver';
import * as path from 'path';
import { ModuleBundler } from '../ModuleBundler';

describe('ModuleBundler', () => {
  jasmine.DEFAULT_TIMEOUT_INTERVAL = 31000;

  const servicePath = path.resolve(__dirname, '../../test/1.0');
  const artifact = Archiver('zip', { store: true });
  const loggerFn = {
    module: jest.fn(),
  };
  const moduleBundler = new ModuleBundler({
    servicePath,
    logger: loggerFn,
    archive: artifact,
  });

  const { dependencies } = require(`${servicePath}/package.json`);

  const findModule = (module) =>
    moduleBundler.modules.find(({ name }) => name === module);

  test('can bundle all dependencies', async () => {
    await moduleBundler.bundle({});

    Object.keys(dependencies).forEach((dep) => {
      expect(moduleBundler.modules.some(({ name }) => name === dep)).toBeTruthy();
    });
  });

  test('can include specific dependencies', async () => {
    const includePackage = 'lutils';
    await moduleBundler.bundle({ include: [includePackage] });

    expect(findModule(includePackage)).toBeTruthy();
    expect(moduleBundler.modules).toHaveLength(1);
  });

  test('can exclude specific dependencies', async () => {
    const excludePackage = 'bluebird';
    await moduleBundler.bundle({ exclude: [excludePackage] });

    expect(findModule(excludePackage)).toBeFalsy();
    expect(findModule('lutils')).toBeTruthy();
  });

  test('can deep exclude specific dependencies', async () => {
    const excludePackage = 'babel-runtime';
    await moduleBundler.bundle({ exclude: [excludePackage], deepExclude: [excludePackage] });

    expect(findModule(excludePackage)).toBeFalsy();
    expect(findModule('lutils')).toBeTruthy();
  });
});
