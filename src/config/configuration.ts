export default () => {
  return {
    port: process.env.PORT || 2222,

    socksHost: process.env.SOCKS_HOST,
  };
};
