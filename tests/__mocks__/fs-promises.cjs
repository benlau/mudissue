const FORBIDDEN_MESSAGE =
  globalThis.__FORBIDDEN_FS_MESSAGE__ ||
  'Forbidden: fs usage in tests. Use mocks instead.';

const forbiddenAsync = (name) => {
  return async (..._args) => {
    throw new Error(`${FORBIDDEN_MESSAGE} (fs.promises.${name})`);
  };
};

module.exports = {
  constants: forbiddenAsync('constants'),
  access: forbiddenAsync('access'),
  appendFile: forbiddenAsync('appendFile'),
  copyFile: forbiddenAsync('copyFile'),
  cp: forbiddenAsync('cp'),
  mkdir: forbiddenAsync('mkdir'),
  open: forbiddenAsync('open'),
  readFile: forbiddenAsync('readFile'),
  readdir: forbiddenAsync('readdir'),
  rename: forbiddenAsync('rename'),
  rm: forbiddenAsync('rm'),
  stat: forbiddenAsync('stat'),
  lstat: forbiddenAsync('lstat'),
  unlink: forbiddenAsync('unlink'),
  writeFile: forbiddenAsync('writeFile'),
};
