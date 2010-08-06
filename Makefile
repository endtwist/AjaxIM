SRC_DIR = client/js
BUILD_DIR = build

PREFIX = .
DIST_DIR = client/js

BASE_FILES = ${SRC_DIR}/md5.js\
	${SRC_DIR}/store.js\
	${SRC_DIR}/cookies.js\
	${SRC_DIR}/dateformat.js\
	${SRC_DIR}/json.js\
	${SRC_DIR}/im.js

MODULES = ${SRC_DIR}/intro.js\
	${BASE_FILES}\
	${SRC_DIR}/outro.js

IMJS = ${DIST_DIR}/im.compiled.js
IMJS_MIN = ${DIST_DIR}/im.min.js

COMPILER = java -jar ${BUILD_DIR}/google-compiler-20100616.jar

all: imjs min
	@@echo "Ajax IM build complete."

imjs: ${IMJS}

${IMJS}: ${MODULES}
	@@echo "Building" ${IMJS}
	@@cat ${MODULES} | sed 's/debug = true/debug = false/' > ${IMJS}

min: ${IMJS_MIN}

${IMJS_MIN}: ${IMJS}
	@@echo "Building" ${IMJS_MIN}
	
	@@head -21 ${IMJS} > ${IMJS_MIN}
	@@${COMPILER} --js ${IMJS} --warning_level QUIET >> ${IMJS_MIN}
	@@rm -f ${IMJS}

clean:
	@@echo "Removing built files"
	@@rm -f ${IMJS}
	@@rm -f ${IMJS_MIN}
