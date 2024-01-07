/*
 * View model for OctoPrint-FlashSailfish
 *
 * Author: Mark Walker
 * License: GPLv3
 */
$(function() {
    function FlashsailfishViewModel(parameters) {
        const self = this;

        self.settings = parameters[0];

        self.boards = ko.observableArray([]);
        self.board = ko.observable(undefined);
        self.versions = ko.observableArray([]);
        self.version = ko.observable(undefined);
        self.firmware_path = ko.observable(undefined);

        self.firmware_info = undefined;

        self.custom_selected = ko.computed(() => {
            return self.version() === "custom";
        });

        self.flash_firmware = function() {
        };

        self.refresh_firmware_xml = function() {
    $.getJSON("/plugin/flashsailfish/firmware_info", function(data) {
        self.firmware_info = data;
        self.refresh_observables();
    });
};
        self.update_firmware = function() {
            $.ajax({
                url: API_BASEURL + "plugin/flashsailfish/update_firmware",
                type: "POST",
                success: function(data) {
                    // Handle success
                    console.log("Firmware update status: " + data.status);
                    // You can update the UI based on the firmware update status if needed
                },
                error: function(xhr, status, error) {
                    // Handle error
                    console.error("Firmware update failed: " + error);
                }
            });
        };

        self.refresh_observables = function() {
    self.boards.removeAll();  // Clear the array first

    if (self.firmware_info !== undefined) {
        for (const board in self.firmware_info) {
            if (self.firmware_info.hasOwnProperty(board)) {
                self.boards.push(board);
            }
        }
        self.boards.sort();
    }
};

        self.fetch_firmware_info = function() {
            $.getJSON("/plugin/flashsailfish/firmware_info", function(data) {
                self.firmware_info = data;
                self.refresh_observables();
            });
        };

        self.onSettingsShown = self.fetch_firmware_info;
    }

    // view model class, parameters for constructor, container to bind to
    OCTOPRINT_VIEWMODELS.push([
        FlashsailfishViewModel,
        [ "settingsViewModel" ],
        [ "#settings_plugin_flashsailfish" ]
    ]);
});
