# coding=utf-8

import flask
import logging
import logging.handlers
import os
import requests
import xmltodict
import tempfile
import octoprint.plugin

from octoprint.server import admin_permission


class FlashSailfishPlugin(octoprint.plugin.BlueprintPlugin,
                          octoprint.plugin.TemplatePlugin,
                          octoprint.plugin.AssetPlugin,
                          octoprint.plugin.SettingsPlugin,
                          octoprint.plugin.EventHandlerPlugin):
    """OctoPrint plugin for flashing Sailfish firmware."""

    def __init__(self):
        """Initialize the FlashSailfishPlugin."""
        self.xml = None
        self.firmware_info = None

        # Add logging setup here
        self._logger = logging.getLogger(__name__)
        self._logger.setLevel(logging.DEBUG)
        formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')

        # You can customize the log file location here
        log_file_path = os.path.join(tempfile.gettempdir(), 'flash_sailfish.log')

        file_handler = logging.handlers.RotatingFileHandler(log_file_path, maxBytes=int(1e6), backupCount=3)
        file_handler.setFormatter(formatter)
        self._logger.addHandler(file_handler)

        super().__init__()

    @octoprint.plugin.BlueprintPlugin.errorhandler(Exception)
    def errorhandler(self, error):
        """Handle unhandled exceptions and log them."""
        self._logger.exception(error)
        return error

    @octoprint.plugin.BlueprintPlugin.route("/firmware_info", methods=["GET"])
    @octoprint.server.util.flask.restricted_access
    @admin_permission.require(403)
    def get_firmware_info(self):
        """Get firmware information."""
        return self._firmware_info()

    @octoprint.plugin.BlueprintPlugin.route("/firmware_file", methods=["POST"])
    @octoprint.server.util.flask.restricted_access
    @admin_permission.require(403)
    def firmware_file(self, *args, **kwargs):
        """Handle firmware file upload."""
        pass

    @octoprint.plugin.BlueprintPlugin.route("/refresh_firmware_info", methods=["POST"])
    @octoprint.server.util.flask.restricted_access
    @admin_permission.require(403)
    def refresh_firmware_info(self):
        """Refresh firmware information."""
        if flask.request.json is not None and "url" in flask.request.json:
            self._settings.set(["url"], flask.request.json["url"])
        self.xml = None
        return self._firmware_info()

    @octoprint.plugin.BlueprintPlugin.route("/update_firmware", methods=["POST"])
    @octoprint.server.util.flask.restricted_access
    @admin_permission.require(403)
    def update_firmware(self):
        """Trigger firmware update."""
        firmware_updater = self.get_firmware_updater()
        update_status = firmware_updater.check_for_updates()
        return flask.jsonify({"status": update_status.name})

    def _firmware_info(self):
        """Retrieve and parse firmware information."""
        if self.xml is None:
            url = self._settings.get(["url"])
            try:
                self.xml = requests.get(url)
            except Exception as e:
                self._logger.exception(f"Unable to retrieve firmware information from {url}: {e}")
                return flask.make_response(f"Unable to retrieve firmware information from {url}", 400)
            try:
                self.firmware_info = xmltodict.parse(self.xml.text)
            except Exception as e:
                self._logger.exception(
                    f"Retrieved firmware information from {url}, but was unable to understand the response: {e}")
                return flask.make_response(
                    f"Retrieved firmware information from {url}, but was unable to understand the response", 400)
        boards = dict()
        for idx, board_xml in enumerate(self.firmware_info["boards"]["board"]):
            if "@name" in board_xml and "firmware" in board_xml:
                board = dict()
                board["name"] = board_xml["@name"]
                board["idx"] = idx
                board["firmwares"] = dict()
                if not isinstance(board_xml["firmware"], list):
                    board_xml["firmware"] = [board_xml["firmware"]]
                for firmware_xml in board_xml["firmware"]:
                    if "@relpath" in firmware_xml and "@description" in firmware_xml and "@name" in firmware_xml:
                        firmware = dict()
                        firmware["relpath"] = firmware_xml["@relpath"]
                        firmware["description"] = firmware_xml["@description"]
                        board["firmwares"][firmware_xml["@name"]] = firmware
                    else:
                        self._logger.info(f"Skipping firmware {repr(firmware_xml)}")
                boards[board_xml["@name"]] = board
            else:
                self._logger.info(f"Skipping board {repr(board_xml)}")
        return flask.jsonify(boards)

    def get_firmware_updater(self):
        """Get the firmware updater instance."""
        return FirmwareRetriever(
            firmwareXml=os.path.join(self.get_plugin_data_folder(), "firmware.xml"),
            firmwareSourceURL=self._settings.get(["url"])
        )

    # ~~ SettingsPlugin API
    def get_settings_defaults(self):
        return {
            "url": "https://s3.amazonaws.com/sailfish-firmware.polar3d.com/release/firmware.xml",
        }

    # ~~ AssetPlugin API
    def get_assets(self):
        return dict(
            js=["js/flashsailfish.js"],
            css=["css/flashsailfish.css"],
            less=["less/flashsailfish.less"]
        )

    # ~~ Update hook
    def get_update_information(self):
        return dict(
            flashsailfish=dict(
                displayName="Flash Sailfish",
                displayVersion=self._plugin_version,

                # version check: gitHub repository
                type="github_release",
                user="markwal",
                repo="octoflashsailfish",
                current=self._plugin_version,

                # stable releases
                stable_branch=dict(
                    name="Stable",
                    branch="master",
                    comittish=["master"]
                ),

                # release candidates
                prerelease_branches=[
                    dict(
                        name="Release Candidate",
                        branch="rc",
                        comittish=["rc", "master"],
                    ),
                    dict(
                        name="Development",
                        branch="devel",
                        comittish=["devel", "rc", "master"],
                    )
                ],

                # update method: pip
                pip="https://github.com/wesk1/octoflashsailfish/archive/{target_version}.zip"
            )
        )

    def is_blueprint_csrf_protected(self):
        return True


class FlashException(Exception):
    def __init__(self, reason):
        super().__init__()
        self.reason = reason


__plugin_name__ = "Flash Sailfish"

__plugin_pythoncompat__ = ">=3.7,<4"

# Set the global __plugin_implementation__ variable
__plugin_implementation__ = FlashSailfishPlugin()

# Set the global __plugin_hooks__ variable
__plugin_hooks__ = {
    "octoprint.plugin.softwareupdate.check_config": __plugin_implementation__.get_update_information
}


# Entry point for OctoPrint to load the plugin
def __plugin_load__():
    global __plugin_implementation__
    global __plugin_hooks__

    __plugin_implementation__ = FlashSailfishPlugin()

    __plugin_hooks__ = {
        "octoprint.plugin.softwareupdate.check_config": __plugin_implementation__.get_update_information
    }
