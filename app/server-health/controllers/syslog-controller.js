/**
 * Controller for log
 *
 * @module app/serverHealth
 * @exports sysLogController
 * @name sysLogController
 */

window.angular && (function(angular) {
  'use strict';
  angular.module('app.serverHealth')
      .config([
        'paginationTemplateProvider',
        function(paginationTemplateProvider) {
          paginationTemplateProvider.setString(
              require('../../common/directives/dirPagination.tpl.html'));
        }
      ])

      .controller('sysLogController', [
        '$scope', '$filter', '$timeout', 'APIUtils', 'toastService',
        'Constants',
        function($scope, $filter, $timeout, APIUtils, toastService, Constants) {
          $scope.itemsPerPage = Constants.PAGINATION.LOG_ITEMS_PER_PAGE;
          $scope.loading = true;
          $scope.sysLogs = [];
          $scope.customSearch = '';
          $scope.searchTerms = [];
          $scope.showDetails = false;
          $scope.sortKey = 'Id';
          $scope.recordTypeList =
              ['SEL', 'Event', 'Oem'];          // From Redfish specification.
          $scope.selectedRecordType = 'Event';  // Default Select to Event log
          $scope.typeFilter = false;
          $scope.severityList = ['All', 'Critical', 'Warning', 'Ok'];
          $scope.selectedSeverity = 'all';

          $scope.severeLogCount = 0;
          $scope.warningLogCount = 0;
          $scope.suppressAlerts = false;
          $scope.alertloadMessage = '';

          $scope.defaultDaysShown = 30;
          $scope.startdate = new Date();
          $scope.startdate.setDate(
              $scope.startdate.getDate() - $scope.defaultDaysShown);
          $scope.enddate = new Date();
          $scope.start_date = {value: $scope.startdate};
          $scope.end_date = {value: $scope.enddate};
          $scope.keyname = 'Created';
          $scope.reverseSeverity = true;
          $scope.reverse = true;
          $scope.maxLogs =
              1000;  // Redfish API can't pull more than 1000 at once
          $scope.loadInitial = true;
          $scope.outputCount = 200;
          $scope.filterTypes = [];
          $scope.iterateBackwards = false;


          APIUtils.getSystemLogCount().then(
              function(totallogCount) {
                var firstRecord =
                    totallogCount - Constants.PAGINATION.LOG_ITEMS_PER_PAGE;
                $scope.displaySystemLogs(
                    $scope.loadInitial, $scope.outputCount, firstRecord,
                    totallogCount);
              },
              function(error) {
                console.log(JSON.stringify(error));
              })

          $scope.displaySystemLogs = function(
              loadInitial, outputCount, firstRecord, logCount) {
            if (loadInitial) {
              // for fast loading of initial set (overwrite outputCount)
              var outputAmount = Constants.PAGINATION.LOG_ITEMS_PER_PAGE;
            } else {
              var outputAmount = outputCount;
            };

            APIUtils.getSystemLogs(outputAmount, firstRecord)
                .then(
                    function(res) {
                      $scope.sysLogs = [].concat($scope.sysLogs, res);
                      $scope.sysLogs.forEach(function(log) {
                        if ($scope.filterTypes.indexOf(log.SensorType) < 0) {
                          $scope.filterTypes.push(log.SensorType);
                        }
                      });
                    },
                    function(error) {
                      console.log(JSON.stringify(error));
                    })
                .finally(
                    function() {
                      var iterate = false;
                      if (loadInitial) {
                        $scope.loading = false;
                        loadInitial = false;
                        if (!$scope.iterateBackwards) {
                          firstRecord = -outputCount;
                          logCount = logCount - outputAmount;
                        };
                      };
                      if ($scope.iterateBackwards) {
                        if (firstRecord > 0) {
                          iterate = true;
                          if (firstRecord > outputCount) {
                            firstRecord = firstRecord - outputCount;
                          } else {
                            // return remaining if less than outputCount
                            outputCount = firstRecord;
                            firstRecord = 0;
                          };
                        };
                      } else {
                        firstRecord = firstRecord + outputCount;
                        if (firstRecord < logCount) {
                          iterate = true;
                          if ((firstRecord + outputCount) > logCount) {
                            outputCount = logCount - firstRecord;
                          };
                        };
                      };
                      if (iterate) {
                        return $scope.displaySystemLogs(
                            loadInitial, outputCount, firstRecord, logCount);
                      };
                    },
                    function(error) {
                      console.log(JSON.stringify(error));
                    });
          };

          $scope.clearSystemLogEntries = function() {
            $scope.confirm = false;
            APIUtils.clearSystemLogs()
                .then(
                    function(res) {
                      console.log(JSON.stringify(res));
                    },
                    function(error) {
                      console.log(JSON.stringify(error));
                    })
                .finally(function() {
                  $scope.selectRecordType($scope.selectedRecordType, false);
                });
          };

          $scope.sortBy = function(keyname) {
            $scope.reverse = (keyname !== null && $scope.keyname === keyname) ?
                !$scope.reverse :
                false;
            $scope.keyname = keyname;
            $scope.sortKey = keyname;
          };

          $scope.sortBySeverity = function() {
            $scope.reverseSeverity = !$scope.reverseSeverity;
            $scope.sortKey = true;
            $scope.orderDatabySeverity($scope.log.severity);
          };

          $scope.toggleSeverity = function(severity) {
            severity = $filter('lowercase')(severity);
            $scope.selectedSeverity = severity;
          };

          $scope.filterBySeverity = function(log) {
            if ($scope.selectedSeverity == 'all' ||
                $scope.selectedSeverity == 'All')
              return true;
            return (
                ((log.Severity == 'OK') && ($scope.selectedSeverity == 'ok')) ||
                ((log.Severity == 'Warning') &&
                 $scope.selectedSeverity == 'warning') ||
                ((log.Severity == 'Critical') &&
                 $scope.selectedSeverity == 'critical'));
          };

          $scope.orderDatabySeverity = function(log) {
            if ($scope.reverseSeverity) {
              return ['Critical', 'Warning', 'OK'].indexOf(log.Severity);
            } else {
              return ['Ok', 'Warning', 'Critical'].indexOf(log.Severity);
            }
          };

          $scope.$watch('toggle', function() {
            $scope.toggleText = 'Show Details';
            $scope.toggle ? $scope.showDetails = true :
                            $scope.showDetails = false;
          })


          $scope.clear = function() {
            $scope.customSearch = '';
            $scope.searchTerms = [];
          };



          $scope.doSearchOnEnter = function(event) {
            var search =
                $scope.customSearch.replace(/^\s+/g, '').replace(/\s+$/g, '');
            if (event.keyCode === 13 && search.length >= 2) {
              $scope.searchTerms = $scope.customSearch.split(' ');
            } else {
              if (search.length == 0) {
                $scope.searchTerms = [];
              }
            }
          };

          $scope.doSearchOnClick = function() {
            var search =
                $scope.customSearch.replace(/^\s+/g, '').replace(/\s+$/g, '');
            if (search.length >= 2) {
              $scope.searchTerms = $scope.customSearch.split(' ');
            } else {
              if (search.length == 0) {
                $scope.searchTerms = [];
              }
            }
          };

          $scope.filterBySearchTerms = function(log) {
            if (!$scope.searchTerms.length) {
              return true;
            }

            for (var i = 0, length = $scope.searchTerms.length; i < length;
                 i++) {
              // TODO: Form it while getting data
              var search_text = log.Id + ' ' + log.Name.toLowerCase() + ' ' +
                  log.Message.toLowerCase();
              if (search_text.indexOf($scope.searchTerms[i].toLowerCase()) ==
                  -1)
                return false;
            }
            return true;
          };

          $scope.filterByDate = function(log) {
            var logDate = new Date(log.Created);
            if ($scope.start_date && $scope.end_date) {
              return (
                  logDate >= $scope.start_date.value &&
                  logDate <= $scope.end_date.value);
            } else {
              return true;
            }
          };

          $scope.showAlert = function() {
            // only shows logs in warning state if none in critical
            $scope.severeLogCount =
                $filter('filter')($scope.filtersysLogs, 'critical').length;
            $scope.warningLogCount =
                $filter('filter')($scope.filtersysLogs, 'warning').length;
            $scope.alertloadMessage =
                'In the last ' + $scope.defaultDaysShown + ' days:<br>';
            if (($scope.severeLogCount > 0 || $scope.warningLogCount > 0) &&
                !$scope.suppressAlerts) {
              if ($scope.severeLogCount) {
                $scope.alertloadMessage =
                    $scope.alertloadMessage + $scope.severeLogCount;
                $scope.severeLogCount > 1 ?
                    $scope.alertloadMessage = $scope.alertloadMessage +
                        ' critical events have been logged' :
                    $scope.alertloadMessage = $scope.alertloadMessage +
                        ' critical event has been logged';
              } else if ($scope.warningLogCount) {
                $scope.alertloadMessage =
                    $scope.alertloadMessage + $scope.warningLogCount;
                $scope.warningLogCount > 1 ?
                    $scope.alertloadMessage = $scope.alertloadMessage +
                        ' warning events have been logged' :
                    $scope.alertloadMessage = $scope.alertloadMessage +
                        ' warning event has been logged';
              };
              $scope.severeLogCount ?
                  toastService.alert($scope.alertloadMessage) :
                  toastService.warning($scope.alertloadMessage);
              $scope.suppressAlerts = true;
            };
          };
        }
      ]);
})(angular);
