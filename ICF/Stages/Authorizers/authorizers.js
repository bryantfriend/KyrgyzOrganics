// ICF/Stages/Authorizers/authorizers.js

import allowModule from "./Core/allow.js";
import denyModule from "./Core/deny.js";
import passAuthorizeModule from "./Core/passAuthorize.js";
import requireActorRoleModule from "./Core/requireActorRole.js";
import requireContextRoleModule from "./Core/requireContextRole.js";
import requireContextValueModule from "./Core/requireContextValue.js";
import * as gamesAuthorizers from "./domain/games/gamesAuthorizers.js";
import * as hamsterSpinImageAuthorizers from "./domain/hamster/hamsterSpinImageAuthorizers.js";

/**
 * Authorizers
 *
 * This file gathers all authorizer functions and authorizer factories
 * into one readable object.
 *
 * Intent files should import this file, then choose the authorizers they need.
 *
 * Authorize should decide whether the actor is allowed to perform the Intent.
 */

var authorizers = {
  allow: allowModule.allow,
  deny: denyModule.deny,
  passAuthorize: passAuthorizeModule.passAuthorize,

  createRequireActorRoleAuthorizer:
    requireActorRoleModule.createRequireActorRoleAuthorizer,

  createRequireContextRoleAuthorizer:
    requireContextRoleModule.createRequireContextRoleAuthorizer,

  createRequireContextValueAuthorizer:
    requireContextValueModule.createRequireContextValueAuthorizer,

  authorizeOpenGamesDashboard: gamesAuthorizers.authorizeOpenGamesDashboard,
  authorizeOpenGameDetail: gamesAuthorizers.authorizeOpenGameDetail,
  authorizeLoadGameConfig: gamesAuthorizers.authorizeLoadGameConfig,
  authorizeLoadGameSettings: gamesAuthorizers.authorizeLoadGameSettings,
  authorizeSaveDailyLoginBonuses: gamesAuthorizers.authorizeSaveDailyLoginBonuses,
  authorizeLoadGameAnalytics: gamesAuthorizers.authorizeLoadGameAnalytics,
  authorizeLoadSpinImages: gamesAuthorizers.authorizeLoadSpinImages,
  authorizeAddSpinImage: gamesAuthorizers.authorizeAddSpinImage,
  authorizeRemoveSpinImage: gamesAuthorizers.authorizeRemoveSpinImage,
  authorizeOpenPayoutModal: gamesAuthorizers.authorizeOpenPayoutModal,
  authorizeClosePayoutModal: gamesAuthorizers.authorizeClosePayoutModal,
  authorizeLoadPayoutRules: gamesAuthorizers.authorizeLoadPayoutRules,
  authorizeAddPayoutRule: gamesAuthorizers.authorizeAddPayoutRule,
  authorizeUpdatePayoutRule: gamesAuthorizers.authorizeUpdatePayoutRule,
  authorizeRemovePayoutRule: gamesAuthorizers.authorizeRemovePayoutRule,
  authorizeTogglePayoutRule: gamesAuthorizers.authorizeTogglePayoutRule,

  authorizeLoadHamsterSpinImages: hamsterSpinImageAuthorizers.authorizeLoadHamsterSpinImages,
  authorizeAddHamsterSpinImage: hamsterSpinImageAuthorizers.authorizeAddHamsterSpinImage,
  authorizeRemoveHamsterSpinImage: hamsterSpinImageAuthorizers.authorizeRemoveHamsterSpinImage,
  authorizeUpdateHamsterSpinImage: hamsterSpinImageAuthorizers.authorizeUpdateHamsterSpinImage
};

export default authorizers;
