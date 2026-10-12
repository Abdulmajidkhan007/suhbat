// findBy*/waitFor — CI yuklamasida standart 1 s yetmasligi mumkin.
require('@testing-library/react-native').configure({ asyncUtilTimeout: 10_000 });
