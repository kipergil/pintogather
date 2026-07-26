module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }], "nativewind/babel"],
    plugins: [
      [
        "module-resolver",
        {
          // Only "@/*" (mobile/src/*) is aliased — a cross-repo alias to
          // ../shared turned out to be unreliable (this plugin's relative-
          // path computation for the alias target wasn't consistent across
          // Metro's transform workers). Files that need shared/*.ts use a
          // plain relative import instead.
          alias: {
            "@": "./src",
          },
        },
      ],
    ],
  };
};
