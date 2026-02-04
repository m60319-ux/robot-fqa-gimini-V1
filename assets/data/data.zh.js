window.FAQ_DATA_ZH = {
    "meta": {
        "lang": "zh",
        "version": "1.0"
    },
    "categories": [
        {
            "id": "CAT-01",
            "title": "硬體問題",
            "subcategories": [
                {
                    "id": "SUB-101",
                    "title": "馬達異常",
                    "questions": []
                },
                {
                    "id": "SUB-102",
                    "title": "驅動器異常",
                    "questions": [
                        {
                            "id": "Q-002",
                            "title": "驅動器輸出電流過大",
                            "content": {
                                "symptoms": [
                                    "驅動器輸出電流過大"
                                ],
                                "rootCauses": [
                                    "通常發生此狀況馬達的動力線(UVW)可能有問題"
                                ],
                                "solutionSteps": [],
                                "notes": "AL083",
                                "keywords": []
                            }
                        },
                        {
                            "id": "Q-003",
                            "title": "六軸AL830",
                            "content": {
                                "symptoms": [
                                    "六軸J5、J6發生830，內部通訊異常"
                                ],
                                "rootCauses": [],
                                "solutionSteps": [
                                    "J5、J6 P3-09",
                                    "0x3511改為0x3555"
                                ],
                                "notes": "",
                                "keywords": [
                                    "AL830"
                                ]
                            }
                        },
                        {
                            "id": "Q-004",
                            "title": "AL044 驅動器功能使用率警告",
                            "content": {
                                "symptoms": [
                                    "驅動器功能使用率警告",
                                    "Date        Time    Type    No.    Error Code    Description    描述",
                                    "2024-12-09   12:50:19    Axis    Joint-5    AL802    Give motion command when the alarm occurs    有異警發生又下運動命令",
                                    "2024-12-09   12:50:19    Axis    Joint-4    AL802    Give motion command when the alarm occurs    有異警發生又下運動命令",
                                    "2024-12-09   12:50:19    Axis    Joint-3    AL802    Give motion command when the alarm occurs    有異警發生又下運動命令",
                                    "2024-12-09   12:50:19    Axis    Joint-2    AL802    Give motion command when the alarm occurs    有異警發生又下運動命令",
                                    "2024-12-09   12:50:19    Axis    Joint-6    AL044    Warning of Servo Drive function overload    驅動器功能使用率警告",
                                    "2024-12-09   12:50:19    Axis    Joint-1    AL813    Axis error during interpretation of motion command    成員軸發生錯誤",
                                    "2024-12-09   12:50:19    Group    1    E1.813    Axis error during interpretation of motion command    成員軸發生錯誤"
                                ],
                                "rootCauses": [
                                    "該軸P2-66出廠預設值改為0x034。"
                                ],
                                "solutionSteps": [
                                    "該軸P2-66出廠預設值改為0x034。"
                                ],
                                "notes": "",
                                "keywords": [
                                    "AL044",
                                    "驅動器",
                                    "ABC"
                                ]
                            }
                        },
                        {
                            "id": "Q-001",
                            "title": "無法過電",
                            "content": {
                                "symptoms": [
                                    "燈號未亮123"
                                ],
                                "rootCauses": [
                                    "保險絲斷",
                                    "{{img:assets/images/img_1769763508765.png}}{{img:assets/images/img_1769763508765.png}} {{img:assets/images/img_1770014988645.png}}",
                                    "檢查內容"
                                ],
                                "solutionSteps": [
                                    "更換保險絲",
                                    "{{img:assets/images/img_1769763514401.png}}"
                                ],
                                "notes": "",
                                "keywords": [
                                    "AL001"
                                ]
                            }
                        }
                    ]
                }
            ]
        },
        {
            "id": "CAT-02",
            "title": "軟體問題",
            "subcategories": [
                {
                    "id": "SUB-201",
                    "title": "操作異常",
                    "questions": [
                        {
                            "id": "Q-005",
                            "title": "Modbus啟動專案無法運行",
                            "content": {
                                "symptoms": [
                                    "用Modbus 0X228，專案還是無法啟動"
                                ],
                                "rootCauses": [],
                                "solutionSteps": [
                                    "查看DI 6、7是不是STOP，是的話就無法啟動"
                                ],
                                "notes": "",
                                "keywords": [
                                    "Modbus"
                                ]
                            }
                        }
                    ]
                }
            ]
        },
        {
            "id": "CAT-03",
            "title": "",
            "subcategories": [
                {
                    "id": "SUB-301",
                    "title": "",
                    "questions": [
                        {
                            "id": "Q-006",
                            "title": "",
                            "content": {
                                "symptoms": [],
                                "rootCauses": [],
                                "solutionSteps": [],
                                "notes": "",
                                "keywords": []
                            }
                        }
                    ]
                }
            ]
        },
        {
            "id": "CAT-04",
            "title": "",
            "subcategories": [
                {
                    "id": "SUB-401",
                    "title": "",
                    "questions": [
                        {
                            "id": "Q-007",
                            "title": "",
                            "content": {
                                "symptoms": [],
                                "rootCauses": [],
                                "solutionSteps": [],
                                "notes": "",
                                "keywords": []
                            }
                        }
                    ]
                }
            ]
        }
    ]
};