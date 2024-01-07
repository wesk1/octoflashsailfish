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

        self.custom_selected = ko.computed(function() {
        return self.version() === "custom";
        }, self);


        self.flash_firmware = function() {
            // Add your implementation here
        };

        self.refresh_firmware_xml = function() {
            // Add your implementation here
        };

        self.refresh_observables = function() {
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

    // View model class, parameters for constructor, container to bind to
    OCTOPRINT_VIEWMODELS.push([
        FlashsailfishViewModel,
        ["settingsViewModel", "loginStateViewModel", "connectionViewModel", "printerStateViewModel", "accessViewModel"],
        ["#settings_plugin_flashsailfish", "#navbar_plugin_flashsailfish"]
    ]);
});
