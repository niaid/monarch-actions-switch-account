import './sourcemap-register.cjs';/******/ /* webpack/runtime/compat */
/******/ 
/******/ if (typeof __nccwpck_require__ !== 'undefined') __nccwpck_require__.ab = new URL('.', import.meta.url).pathname.slice(import.meta.url.match(/^file:\/\/\/\w:/) ? 1 : 0, -1) + "/";
/******/ 
/************************************************************************/
var __webpack_exports__ = {};

var __createBinding = (undefined && undefined.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (undefined && undefined.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (undefined && undefined.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (undefined && undefined.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALLOWED_ACCOUNTS = void 0;
exports.switchAccount = switchAccount;
exports.createAwsSession = createAwsSession;
exports.clearAssumedRole = clearAssumedRole;
exports.assumeAccountRole = assumeAccountRole;
exports.getAccountIdViaSsm = getAccountIdViaSsm;
exports.exportCredentials = exportCredentials;
const core = __importStar(require("@actions/core"));
const client_sts_1 = require("@aws-sdk/client-sts");
const client_ssm_1 = require("@aws-sdk/client-ssm");
const assert_1 = __importDefault(require("assert"));
const USER_AGENT = 'configure-aws-credentials-for-github-actions';
const DEFAULT_REGION = 'us-east-1';
exports.ALLOWED_ACCOUNTS = ['dev', 'qa', 'stage', 'prod', 'mgmt'];
function switchAccount(accountName) {
    return __awaiter(this, void 0, void 0, function* () {
        (0, assert_1.default)(accountName, 'Missing required input for account to switch to.');
        (0, assert_1.default)(exports.ALLOWED_ACCOUNTS.includes(accountName), `Invalid account name '${accountName}'. Must be one of: ${exports.ALLOWED_ACCOUNTS.join(', ')}`);
        // Do the actual work
        const accountId = yield getAccountIdViaSsm(accountName);
        if (!accountId) {
            throw new Error(`Could not retrieve account ID for ${accountName}`);
        }
        const accountSession = yield assumeAccountRole(accountId);
        exportCredentials(accountSession);
    });
}
function createAwsSession() {
    return __awaiter(this, void 0, void 0, function* () {
        return new client_sts_1.STSClient({
            region: DEFAULT_REGION,
            customUserAgent: USER_AGENT
        });
    });
}
function clearAssumedRole() {
    return __awaiter(this, void 0, void 0, function* () {
        const emptyCreds = {
            AccessKeyId: '',
            SecretAccessKey: '',
            SessionToken: ''
        };
        exportCredentials(emptyCreds);
        // AWS SDK v3 doesn't have global config like v2
        // Return empty credentials to indicate cleared state
        return emptyCreds;
    });
}
function assumeAccountRole(accountId) {
    return __awaiter(this, void 0, void 0, function* () {
        yield clearAssumedRole();
        const sts = yield createAwsSession();
        const roleToAssume = {
            RoleArn: `arn:aws:iam::${accountId}:role/cicd-runner-admin`,
            RoleSessionName: 'monarch-actions-switch-account',
            DurationSeconds: 900
        };
        const command = new client_sts_1.AssumeRoleCommand(roleToAssume);
        const { Credentials } = yield sts.send(command);
        if (!Credentials) {
            throw new Error('no credentials returned');
        }
        return Credentials;
    });
}
function getAccountIdViaSsm(accountName) {
    return __awaiter(this, void 0, void 0, function* () {
        const ssm = new client_ssm_1.SSMClient({
            region: DEFAULT_REGION
        });
        const paramName = `/monarch-ro/space-accounts/${accountName}`;
        try {
            const command = new client_ssm_1.GetParameterCommand({
                Name: paramName,
                WithDecryption: true
            });
            const accountIdParam = yield ssm.send(command);
            if (accountIdParam.Parameter) {
                const accountId = accountIdParam.Parameter.Value;
                return accountId;
            }
        }
        catch (error) {
            if (error instanceof Error)
                core.setFailed(error.message);
        }
    });
}
function exportCredentials(params) {
    // Configure the AWS CLI and AWS SDKs using environment variables and set them as secrets.
    // Setting the credentials as secrets masks them in Github Actions logs
    // AWS_DEFAULT_REGION and AWS_REGION:
    // Specifies the AWS Region to send requests to
    core.exportVariable('AWS_DEFAULT_REGION', DEFAULT_REGION);
    core.exportVariable('AWS_REGION', DEFAULT_REGION);
    // AWS_ACCESS_KEY_ID:
    // Specifies an AWS access key associated with an IAM user or role
    if (params.AccessKeyId)
        core.setSecret(params.AccessKeyId);
    core.exportVariable('AWS_ACCESS_KEY_ID', params.AccessKeyId);
    // AWS_SECRET_ACCESS_KEY:
    // Specifies the secret key associated with the access key. This is essentially the "password" for the access key.
    if (params.SecretAccessKey)
        core.setSecret(params.SecretAccessKey);
    core.exportVariable('AWS_SECRET_ACCESS_KEY', params.SecretAccessKey);
    // AWS_SESSION_TOKEN:
    // Specifies the session token value that is required if you are using temporary security credentials.
    if (params.SessionToken) {
        core.setSecret(params.SessionToken);
        core.exportVariable('AWS_SESSION_TOKEN', params.SessionToken);
    }
    else if (process.env.AWS_SESSION_TOKEN) {
        // clear session token from previous credentials action
        core.exportVariable('AWS_SESSION_TOKEN', '');
    }
}
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            //do account switch stuff
            const account = core.getInput('account');
            yield switchAccount(account);
        }
        catch (error) {
            if (error instanceof Error)
                core.setFailed(error.message);
        }
    });
}
run();


//# sourceMappingURL=index.js.map