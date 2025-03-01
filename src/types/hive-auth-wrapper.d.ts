declare const CMD: {
	CONNECTED: string;
	AUTH_REQ: string;
	AUTH_WAIT: string;
	AUTH_ACK: string;
	AUTH_NACK: string;
	AUTH_ERR: string;
	SIGN_REQ: string;
	SIGN_WAIT: string;
	SIGN_ACK: string;
	SIGN_NACK: string;
	SIGN_ERR: string;
	CHALLENGE_REQ: string;
	CHALLENGE_WAIT: string;
	CHALLENGE_ACK: string;
	CHALLENGE_NACK: string;
	CHALLENGE_ERR: string;
	ATTACH_REQ: string;
	ATTACH_ACK: string;
	ATTACH_NACK: string;
	ERROR: string;
};

declare const DELAY_CHECK_WEBSOCKET: number;
declare const DELAY_CHECK_REQUESTS: number;
declare const HAS_SERVER: string;
declare const HAS_PROTOCOLS: number[];
declare const HAS_options: {
	host: string;
	auth_key_secret?: string;
};

declare let HAS_connected: boolean;
declare let HAS_timeout: number;
declare let wsHAS: WebSocket | undefined;
declare let trace: boolean;

type Message = {
	cmd: string;
	uuid: string;
	expire: number;
	key?: string;
};

declare function getMessage(type: string, uuid?: string): Message | undefined;
declare function startWebsocket(): void;
declare function send(message: string): void;
declare function sleep(ms: number): Promise<void>;
declare function attach(uuid: string): Promise<Message>;
declare function checkConnection(uuid?: string): Promise<boolean>;

declare class Auth {
	constructor(username: string, expire?: number, key?: string);
	username: string;
	expire?: number;
	key?: string;
}

declare module 'hive-auth-wrapper' {
	function setOptions(options: { host?: string; auth_key_secret?: string }): void;
	function traceOn(): void;
	function traceOff(): void;
	function status(): { host: string; connected: boolean; timeout: number };
	function connect(): Promise<boolean>;
	/**
	 * Sends an authentication request to the server
	 * @param {Object} auth
	 * @param {string} auth.username
	 * TODO - Remove "token" when protocol v0 is deprecated
	 * @param {string=} auth.token - DEPRECATED since protocol v1
	 * TODO -
	 * @param {number=} auth.expire
	 * @param {string=} auth.key
	 * @param {Object} app_data
	 * @param {string} app_data.name - Application name
	 * @param {string} app_data.description - Application description
	 * @param {string} app_data.icon - URL of application icon
	 * @param {Object} challenge_data - (optional)
	 * @param {string} challenge_data.key_type - key type required to sign the challenge (posting, active, memo)
	 * @param {string} challenge_data.challenge - a string to be signed
	 * @param {Object} cbWait - (optional) callback method to notify the app about pending request
	 */
	function authenticate(
		auth: { username: string; token?: string; expire?: number; key?: string },
		app_data: { name: string; description: string; icon: string },
		challenge_data?: { key_type: string; challenge: string },
		cbWait?: (req: Response) => void
	): Promise<Response>;
	/**
	 * Sends a broadcast request to the server
	 * @param {Object} auth
	 * @param {string} auth.username
	 * TODO - Remove "token" when protocol v0 is deprecated
	 * @param {string=} auth.token - DEPRECATED since protocol v1
	 * TODO -
	 * @param {number=} auth.expire
	 * @param {string=} auth.key
	 * @param {string} key_type
	 * @param {Array} ops
	 * @param {Object} cbWait - (optional) callback method to notify the app about pending request
	 */
	function broadcast(
		auth: { username: string; token?: string; expire?: number; key?: string },
		key_type: string,
		ops: unknown[],
		cbWait?: (req: Response) => void
	): Promise<Response>;
	/**
	 * Sends a challenge request to the server
	 * @param {Object} auth
	 * @param {string} auth.username
	 * TODO -
	 * @param {number=} auth.expire
	 * @param {string=} auth.key
	 * @param {Object} challenge_data
	 * @param {string} challenge_data.key_type - key type required to sign the challenge (posting, active, memo)
	 * @param {string} challenge_data.challenge - a string to be signed
	 * @param {Object} cbWait - (optional) callback method to notify the app about pending request
	 */
	function challenge(
		auth: { username: string; expire?: number; key?: string },
		challenge_data: { key_type: string; challenge: string },
		cbWait?: (req: unknown) => void
	): Promise<unknown>;
}
