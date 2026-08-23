export const todayUtc = () => new Date().toISOString().slice(0, 10);

export const readArgument = (argumentsList, name) => {
  const index = argumentsList.indexOf(name);
  return index >= 0 ? argumentsList[index + 1] : undefined;
};
