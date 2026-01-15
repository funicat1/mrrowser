

module.exports = {
  packagerConfig: {
    name: 'Mrrowser',
    executableName: 'mrrowser',
    icon: './icon.png',
    asar: true,
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'mrrowser'
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-deb',
      config: {
        options: {
          maintainer: 'funicat',
          homepage: 'https://github.com/funicat1/mrrowser'
        }
      },
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {
        options: {
          maintainer: 'funicat',
          homepage: 'https://github.com/funicat1/mrrowser'
        }
      },
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
  ],
};

