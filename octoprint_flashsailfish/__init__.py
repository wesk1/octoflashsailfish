import flask
import logging
import logging.handlers
import os
import requests
import xmltodict
import tempfile
import octoprint.plugin

from octoprint.server import admin_permission
from werkzeug.utils import secure_filename


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
        self.configure_logging()
        self.create_directory()  # Call the method to create the directory
        super().__init__()

    def create_directory(self):
        """Create the directory if it doesn't exist."""
        directory_path = os.path.join(os.path.expanduser("/opt/OctoPrint/flashsailfish/firmwares/"))
        if not os.path.exists(directory_path):
            try:
                os.makedirs(directory_path)
                self._logger.info(f"Directory '{directory_path}' created successfully.")
            except Exception as e:
                self._logger.exception(f"Error creating directory '{directory_path}': {e}")
        else:
            self._logger.debug(f"Directory '{directory_path}' already exists.")

    def configure_logging(self):
        """Configure logging."""
        self._logger = logging.getLogger(__name__)
        self._logger.setLevel(logging.DEBUG)
        formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')

        log_file_path = os.path.join(tempfile.gettempdir(), 'flash_sailfish.log')
        file_handler = logging.handlers.RotatingFileHandler(log_file_path, maxBytes=int(1e6), backupCount=3)
        file_handler.setFormatter(formatter)
        self._logger.addHandler(file_handler)

    @octoprint.plugin.BlueprintPlugin.errorhandler(Exception)
    def errorhandler(self, error):
        """Handle unhandled exceptions and log them."""
        self._logger.exception("Unhandled exception:")
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
    def firmware_file(self):
        print("File upload initiated")
        """Handle firmware file upload."""
        target_folder = "/tmp/"  # Update this to the desired target folder

        # Check if the 'file' key is in the request
        if "file" not in flask.request.files:
            return flask.make_response("No file part", 400)

        file = flask.request.files["file"]

        # Check if the file is empty
        if file.filename == "":
            return flask.make_response("No selected file", 400)

        # Securely save the file to the target folder
        filename = secure_filename(file.filename)
        file.save(os.path.join(target_folder, filename))

        # Log the successful file upload
        self._logger.info(f"File '{filename}' successfully uploaded to {target_folder}")

        return flask.jsonify({"message": "File successfully uploaded"})

    @octoprint.plugin.BlueprintPlugin.route("/refresh_firmware_info", methods=["POST"])
    @octoprint.server.util.flask.restricted_access
    @admin_permission.require(403)
    def refresh_firmware_info(self):
        """Refresh firmware information."""
        if flask.request.json is not None and "url" in flask.request.json:
            self._settings.set(["url"], flask.request.json["url"])
        self.xml = None
        return self._firmware_info()

    @octoprint.plugin.BlueprintPlugin.route("/download_firmware", methods=["GET"])
    @octoprint.server.util.flask.restricted_access
    @admin_permission.require(403)
    def download_firmware(self):
        try:
            data = flask.request.json
            xml_path = data.get("url")
            destination_dir = "/opt/OctoPrint/flashsailfish/firmwares/"  # Update this to the desired destination

            response = requests.get(xml_path)
            firmware_content = response.content

            # Extract firmware information from the XML path (modify this logic based on your XML structure)
            firmware_info = xmltodict.parse(response.text)
            board_name = firmware_info["board"]["@name"]
            firmware_name = firmware_info["firmware"]["@name"]
            firmware_version = firmware_info["firmware"]["@version"]

            # Construct a meaningful filename based on the firmware information
            filename = f"{board_name}-{firmware_name}-v{firmware_version}.hex"

            # Save the firmware to the specified destination directory
            with open(os.path.join(destination_dir, filename), "wb") as firmware_file:
                firmware_file.write(firmware_content)

            return flask.jsonify({"message": "Firmware download initiated"})
        except Exception as f:
            self._logger.exception(f"Firmware download initiation failed: {firmware_file}: {f}")
            return flask.make_response("Firmware download initiation failed", 500)

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
                        firmware["protocol"] = firmware_xml.get("protocol", "")
                        firmware["speed"] = firmware_xml.get("speed", "")
                        firmware["arch"] = firmware_xml.get("arch", "")
                        firmware["manualreset"] = firmware_xml.get("manualreset", "")
                        board["firmwares"][firmware_xml["@name"]] = firmware
                    else:
                        self._logger.info(f"Skipping firmware {repr(firmware_xml)}")
                boards[board_xml["@name"]] = board
            else:
                self._logger.info(f"Skipping board {repr(board_xml)}")
        return flask.jsonify(boards)

    # ~~ SettingsPlugin API
    def get_settings_defaults(self):
        return {
            "base_url": "https://s3.amazonaws.com/sailfish-firmware.polar3d.com/release/",  # baseurl to be used for
            # downloading firmware + relpath from xml file
            "url": "https://s3.amazonaws.com/sailfish-firmware.polar3d.com/release/firmware.xml",  # xml file for
            # firmware, board,versions info
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
                user="wesk1",
                repo="octoflashsailfish",
                current=self._plugin_version,

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


def __plugin_load__():
    global __plugin_implementation__
    global __plugin_hooks__
