const { verifyAccessToken, clearCookie } = require("../controllers/functions/token");
const { userFindOne } = require("../controllers/functions/sequelize");
const {
  DBERROR,
  TranslateFromAreaNameToAreaInfo,
  TranslateFromSportNameToSportInfo,
} = require("../controllers/functions/utility");
const AUTH_ERROR = { message: "Authentication Error" };

module.exports = {
  isAuth: async (req, res, next) => {
    const accessToken = req.cookies.jwt;
    if (!accessToken) {
      return res.status(403).json(AUTH_ERROR);
    }

    const decoded = verifyAccessToken(accessToken);
    if (!decoded) {
      clearCookie(res);
      return res.status(403).json(AUTH_ERROR);
    }
    const foundUser = await userFindOne({ id: decoded.id });
    if (!foundUser) {
      clearCookie(res);
      return res.status(403).json(AUTH_ERROR);
    }
    res.locals.userId = foundUser.dataValues.id;
    res.locals.type = foundUser.dataValues.type;
    res.locals.token = accessToken;
    return next();
  },
  checkNickname: async (req, res, next) => {
    const nickname = req.params.nickname ?? req.body.nickname;
    try {
      const userInfo = await userFindOne({ nickname });
      if (userInfo) return res.status(400).json({ message: `${nickname} already exists` });
      return next();
    } catch (err) {
      DBERROR(res, err);
    }
  },
  checkEmail: async (req, res, next) => {
    const email = req.params.email ?? req.body.email;
    try {
      const userInfo = await userFindOne({ email });
      if (userInfo) {
        const { type } = userInfo.dataValues;
        return res.status(400).json({ message: `${email} already exists`, type });
      }
      return next();
    } catch (err) {
      DBERROR(res, err);
    }
  },
  checkPermission: async (req, res, next) => {
    if (res.locals.userId !== req.params.userId) {
      return res.status(400).json({ message: "You don't have permission" });
    }
    next();
  },
  createConditionsForSearching: (req, res, next) => {
    const { sportName, areaName, time, date, totalNum } = req.query;
    const areaId = TranslateFromAreaNameToAreaInfo(areaName)?.id;
    const sportInfo = TranslateFromSportNameToSportInfo(sportName);
    const sportId = sportInfo?.id;
    delete sportInfo?.id;
    res.locals.gathering = {
      time,
      date,
      totalNum,
      areaId,
      sportId,
    };
    res.locals.conditions = { ...req.query, ...sportInfo };
    next();
  },
  checkToCreateGathering: (req, res, next) => {
    const {
      title,
      description,
      placeName,
      latitude,
      longitude,
      date,
      time,
      timeDescription,
      totalNum,
      areaName,
      sportName,
    } = req.body;
    if (
      !(
        title &&
        description &&
        placeName &&
        latitude &&
        longitude &&
        date &&
        time &&
        timeDescription &&
        totalNum &&
        areaName &&
        sportName
      )
    ) {
      return res.status(400).json({ message: "Incorrect format" });
    }
    const { userId } = res.locals;
    const sportInfo = TranslateFromSportNameToSportInfo(req.body.sportName);
    const sportId = sportInfo.id;
    const areaId = TranslateFromAreaNameToAreaInfo(req.body.areaName).id;
    delete req.body.sportName;
    delete req.body.areaName;
    res.locals.setGatheringInfo = {
      ...req.body,
      currentNum: 1,
      creatorId: userId,
      sportId,
      areaId,
    };
    delete sportInfo.id;
    delete sportInfo.sportEngName;
    res.locals.sportInfo = sportInfo;
    next();
  },
};
