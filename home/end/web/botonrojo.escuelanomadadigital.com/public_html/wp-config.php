<?php
/**
 * The base configuration for WordPress
 *
 * The wp-config.php creation script uses this file during the installation.
 * You don't have to use the website, you can copy this file to "wp-config.php"
 * and fill in the values.
 *
 * This file contains the following configurations:
 *
 * * Database settings
 * * Secret keys
 * * Database table prefix
 * * ABSPATH
 *
 * @link https://developer.wordpress.org/advanced-administration/wordpress/wp-config/
 *
 * @package WordPress
 */

// ** Database settings - You can get this info from your web host ** //
/** The name of the database for WordPress */
define('DB_NAME', 'end_54947');

/** Database username */
define('DB_USER', 'end_54947');

/** Database password */
define('DB_PASSWORD', 'bffde17f3018fddf9afc');

/** Database hostname */
define('DB_HOST', 'localhost');

/** Database charset to use in creating database tables. */
define('DB_CHARSET', 'utf8mb4');

/** The database collate type. Don't change this if in doubt. */
define('DB_COLLATE', '');

/**#@+
 * Authentication unique keys and salts.
 *
 * Change these to different unique phrases! You can generate these using
 * the {@link https://api.wordpress.org/secret-key/1.1/salt/ WordPress.org secret-key service}.
 *
 * You can change these at any point in time to invalidate all existing cookies.
 * This will force all users to have to log in again.
 *
 * @since 2.6.0
 */
define('AUTH_KEY', 'Pt4`ch5GW,$t50Lk)$c@AgtAwvi;<X$i(ITozgoNsmen;eBq )&!6p&-?qNk.uv^');
define('SECURE_AUTH_KEY', 'nX-4Q.88{fX6)kh`Ud=AdZA51w`)8$q]o/8tV@bIh%wCe3^xRewTpn;FcC3aIVJa');
define('LOGGED_IN_KEY', '@~0<*,+H+jdjb==|pA-fUrxeFm;uhBk<CNKtya+[Vf709V;=Eyu`<r?!qN1-xSyX');
define('NONCE_KEY', 'L-KFu2{OPVSQziK]_CeD.;*!eZcYz[;;]x=ED,A){=-C5uW+Q9>tums.YN,6Q,-I');
define('AUTH_SALT', 'N8TgB-KzySFmObEMv<;@aWc~7/7Yg<~9+(A]2UWKSn_|#kQ:bg}o,$Zn5@E<|6BW');
define('SECURE_AUTH_SALT', 'A=?fn`UJy[I&ui>u<)-o-1&+}w;9j~nlFCu!kx!{uF.1<jWK4A!h3y0Ai`kNXRLh');
define('LOGGED_IN_SALT', ']HYlam:@A?C`+M?t-9Fj$0{y958oh`s1u6VP-jv/6EpB!bPVz3[h.7dUp|3u,=t.');
define('NONCE_SALT', 'h&WcDs: DzY(VRY}m4IXf!5OOZQ&VtP.g3J|-Q/WCZP?{UG:bh#Bt~A2PJ[rYd+S');

/**#@-*/

/**
 * WordPress database table prefix.
 *
 * You can have multiple installations in one database if you give each
 * a unique prefix. Only numbers, letters, and underscores please!
 *
 * At the installation time, database tables are created with the specified prefix.
 * Changing this value after WordPress is installed will make your site think
 * it has not been installed.
 *
 * @link https://developer.wordpress.org/advanced-administration/wordpress/wp-config/#table-prefix
 */
$table_prefix = 'wp_L5cTs_';


/**
 * For developers: WordPress debugging mode.
 *
 * Change this to true to enable the display of notices during development.
 * It is strongly recommended that plugin and theme developers use WP_DEBUG
 * in their development environments.
 *
 * For information on other constants that can be used for debugging,
 * visit the documentation.
 *
 * @link https://developer.wordpress.org/advanced-administration/debug/debug-wordpress/
 */
define('WP_DEBUG', true);

define('WP_DEBUG_LOG', true);

define('WP_DEBUG_DISPLAY', false);

/* Add any custom values between this line and the "stop editing" line. */



/* That's all, stop editing! Happy publishing. */

/** Absolute path to the WordPress directory. */
if (!defined('ABSPATH')) {
	define('ABSPATH', __DIR__ . '/');
}

/** Sets up WordPress vars and included files. */
require_once ABSPATH . 'wp-settings.php';